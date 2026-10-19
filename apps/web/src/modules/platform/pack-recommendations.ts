import { db } from "./db";
import { fail,requireActor,type Actor } from "./auth";
import { safePack } from "./feature-eligibility";
import { playableQuizWhere } from "./content-locale";
import { checkedRun } from "./runs";
import { rankRelatedPacks, type RankingCandidate } from "./pack-recommendation-ranking";
import type { Locale } from "../../i18n/core";

function idsFromJson(value:unknown):string[]{
  return Array.isArray(value)?value.filter((x):x is string=>typeof x==="string"):[];
}
/** Manual choices never change quiz content, pack version or Kids moderation status. */
export async function packRecommendationsSet(p:Record<string,any>,actor:Actor|null){
  const user=requireActor(actor);
  if(user.childScope)fail(403,"forbidden","Kids sessions cannot edit packs");
  const source=await db().quizPack.findFirst({where:{id:p.id,authorId:user.id},
    select:{id:true,sourceLocale:true}});
  if(!source)fail(404,"not_found","Owned pack not found");
  for(const id of p.packIds as string[]){
    if(id===p.id)fail(400,"invalid_related_pack","A pack cannot recommend itself");
    if(!["en","ko"].includes(source.sourceLocale))
      fail(409,"locale_missing","Set the original pack language before linking recommendations");
    await safePack(id,source.sourceLocale as Locale,"GENERAL");
  }
  await db().$transaction(async tx=>{
    await tx.quizPack.update({where:{id:source.id},data:{recommendedPackIds:p.packIds}});
    await tx.auditLog.create({data:{actorId:user.id,action:"pack.recommendations.update",objectId:source.id}});
  });
  return {id:source.id,packIds:p.packIds};
}
export async function packRecommendationsGet(p:Record<string,any>,actor:Actor|null){
  const locale=p.locale as Locale;
  // Same publication, language, moderation and media gates as real pack playback.
  const current=await safePack(p.id,locale,"GENERAL");
  const source=await db().quizPack.findUniqueOrThrow({where:{id:p.id},
    select:{authorId:true,recommendedPackIds:true,items:{select:{quizId:true}}}});
  const manualIds=idsFromJson(source.recommendedPackIds).slice(0,3);
  const where={
    id:{not:p.id},publication:"PUBLISHED",safetyStatus:"ACTIVE",
    localizations:{some:{locale,status:"PUBLISHED"}},
    items:{some:{quiz:playableQuizWhere(locale)}}
  };
  const select={
    id:true,authorId:true,updatedAt:true,
    localizations:{where:{locale,status:"PUBLISHED"},select:{title:true}},
    items:{select:{quizId:true}}
  } as const;
  const [recent,manual,past]=await Promise.all([
    db().quizPack.findMany({where,select,orderBy:{updatedAt:"desc"},take:120}),
    manualIds.length?db().quizPack.findMany({where:{...where,id:{in:manualIds}},select}):Promise.resolve([]),
    actor&&!actor.childScope?db().playRun.findMany({where:{userId:actor.id,mode:"PACK",lane:"GENERAL",status:"FINISHED",locale},
      orderBy:{completedAt:"desc"},take:150,select:{packId:true}}):Promise.resolve([])
  ]);
  const pool=[...new Map([...manual,...recent].map(row=>[row.id,row])).values()];
  if(!pool.length)return {id:p.id,locale,items:[]};
  const questionIds=[...new Set([...current.items.map(i=>i.quizId),...pool.flatMap(row=>row.items.map(i=>i.quizId))])];
  const [topics,counts]=await Promise.all([
    db().quizTopic.findMany({where:{quizId:{in:questionIds},isSpoiler:false},select:{quizId:true,topicId:true}}),
    db().playRun.groupBy({by:["packId"],where:{packId:{in:pool.map(row=>row.id)},
      mode:"PACK",lane:"GENERAL",status:"FINISHED",locale},_count:{_all:true}})
  ]);
  const topicMap=new Map<string,string[]>();
  for(const item of topics)topicMap.set(item.quizId,[...(topicMap.get(item.quizId)??[]),item.topicId]);
  const sourceIds=current.items.map(item=>item.quizId);
  const sourceTopics=[...new Set(sourceIds.flatMap(id=>topicMap.get(id)??[]))];
  const playCounts=new Map(counts.map(row=>[row.packId,row._count._all]));
  const ranked=rankRelatedPacks(
    {id:p.id,title:current.title,authorId:source.authorId,topicIds:sourceTopics,quizIds:sourceIds},
    pool.map((row):RankingCandidate=>({
      id:row.id,authorId:row.authorId,title:row.localizations[0]?.title??"",
      quizIds:row.items.map(item=>item.quizId),
      topicIds:[...new Set(row.items.flatMap(item=>topicMap.get(item.quizId)??[]))],
      plays:playCounts.get(row.id)??0,updatedAt:row.updatedAt.getTime()
    })),manualIds,past.map(row=>row.packId).filter((id):id is string=>!!id)
  );
  const items:{id:string;title:string;description:string;questionCount:number;reason:"CURATED"|"RELATED"|"POPULAR"}[]=[];
  for(const candidate of ranked) {
    if(items.length>=p.limit)break;
    try{
      const playable=await safePack(candidate.id,locale,"GENERAL");
      const related=candidate.authorId===source.authorId ||
        candidate.topicIds.some(id=>sourceTopics.includes(id)) ||
        candidate.quizIds.some(id=>sourceIds.includes(id)) ||
        candidate.title.toLowerCase().split(/\s+/).some(word=>word.length>2&&current.title.toLowerCase().includes(word));
      items.push({id:candidate.id,title:playable.title,description:playable.description,
        questionCount:playable.questionCount,
        reason:manualIds.includes(candidate.id)?"CURATED":related?"RELATED":"POPULAR"});
    }catch{ /* Withheld or media-invalid packs must never be recommended. */ }
  }
  return {id:p.id,locale,items};
}
/** A completed signed General run is required; repeated refreshes/clicks are idempotent. */
export async function packRecommendationTrack(p:Record<string,any>,actor:Actor|null){
  const run=await checkedRun(p.runId,p.runToken,actor);
  if(run.mode!=="PACK"||run.lane!=="GENERAL"||run.status!=="FINISHED"||!run.packId)
    fail(403,"recommendation_forbidden","Complete a general quiz pack before recording recommendations");
  const choices=await packRecommendationsGet({id:run.packId,locale:run.locale,limit:3},actor);
  const allowed=new Set(choices.items.map(item=>item.id));
  if((p.kind==="CLICK"&&p.targetPackIds.length!==1)||p.targetPackIds.some((id:string)=>!allowed.has(id)))
    fail(400,"invalid_recommendation","Only currently recommended packs can be recorded");
  if(!p.targetPackIds.length)return {recorded:0};
  await db().packRecommendationEvent.createMany({
    data:p.targetPackIds.map((targetPackId:string)=>({
      runId:run.id,sourcePackId:run.packId!,targetPackId,kind:p.kind,locale:run.locale
    })),skipDuplicates:true
  });
  return {recorded:p.targetPackIds.length};
}
