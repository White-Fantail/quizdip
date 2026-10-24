import { db } from "./db";
import { mixDiscoveryCards, rotatedCatalogOffset } from "./discovery-mix";
import { playableQuizWhere } from "./content-locale";
import { ratingsForQuizzes } from "./ratings";
import { packRatingsFor } from "./pack-social";
import type { RatingSummary } from "../quiz/rating-metadata";

export type DiscoveryType="QUIZ"|"PACK";
export type DiscoveryCard={
  id:string; type:DiscoveryType;title:string;subtitle:string;creator:string;
  questionCount:number;orderMode?:string;kidsEligible?:boolean;ratings:RatingSummary;started:number;completed:number;
  difficultyPercent:number|null;createdAt:string;
};
export type DiscoverySection={key:"popular_packs"|"new_packs"|"surprise"|"trending"|"popular"|"highly_rated"|"difficult"|"new";
  items:DiscoveryCard[];basis:string};

/** Lower bound for a positive/negative rating distribution; neutral to tiny samples. */
export function wilsonPositiveScore(positive:number,negative:number):number {
  const n=positive+negative;
  if(!n)return 0;
  const z=1.96,p=positive/n,z2=z*z;
  return (p+z2/(2*n)-z*Math.sqrt((p*(1-p)+z2/(4*n))/n))/(1+z2/n);
}
export function packDifficulty(solved:number,failed:number):number|null {
  const total=solved+failed;
  return total>0?Math.round(100*failed/total):null;
}
function takeDiverse(rows:Array<{card:DiscoveryCard;score:number}>,limit=6,maxPerAuthor=2) {
  const selected:DiscoveryCard[]=[], authors=new Map<string,number>();
  rows.sort((a,b)=>b.score-a.score||a.card.id.localeCompare(b.card.id));
  for(const entry of rows) {
    const count=authors.get(entry.card.creator)??0;
    if(count>=maxPerAuthor)continue;
    selected.push(entry.card);authors.set(entry.card.creator,count+1);
    if(selected.length===limit)break;
  }
  return selected;
}
function metricMap(rows:Array<{quizId?:string|null;packId?:string|null;userId:string|null;status:string}>) {
  const data=new Map<string,{starts:Set<string>;completed:Set<string>;solved:Set<string>;failed:Set<string>}>();
  for(const row of rows){
    const id=row.quizId??row.packId;
    if(!id||!row.userId)continue;
    let item=data.get(id);
    if(!item){item={starts:new Set(),completed:new Set(),solved:new Set(),failed:new Set()};data.set(id,item);}
    item.starts.add(row.userId);
    if(["SOLVED","FAILED","FINISHED"].includes(row.status))item.completed.add(row.userId);
    if(row.status==="SOLVED")item.solved.add(row.userId);
    if(row.status==="FAILED")item.failed.add(row.userId);
  }
  return data;
}
function count(map:ReturnType<typeof metricMap>,id:string,key:"starts"|"completed"){
  return map.get(id)?.[key].size??0;
}

/** Adult, registered-account signals only. No guesses, child history or fake metrics.
 * A bounded, eligible catalog is ranked; author diversity and real sample floors
 * keep the dashboard useful without claiming exhaustive all-time rankings.
 */
export async function discoverSections(p:Record<string,any>) {
  const locale=p.locale as "en"|"ko";
  const now=Date.now();
  const last7=new Date(now-7*86400000),last14=new Date(now-14*86400000),
    last30=new Date(now-30*86400000),last90=new Date(now-90*86400000);
  // Stable within a UTC day, but older eligible content gets a rotating window.
  // The bounds remain comparable to the previous 160-quiz/100-pack catalog,
  // avoiding an unbounded ratings/revision or play-history query.
  const rotation=p.rotation as number;
  const day=Math.floor(now/86400000);
  const quizWhere=playableQuizWhere(locale);
  const packWhere={
    publication:"PUBLISHED" as const,safetyStatus:"ACTIVE" as const,
    localizations:{some:{locale,status:"PUBLISHED" as const}},
    items:{some:{quiz:playableQuizWhere(locale)}}
  };
  const quizSelect={id:true,authorId:true,createdAt:true,answerType:true,
    author:{select:{displayName:true}},
    localizations:{where:{locale,status:"PUBLISHED" as const},
      select:{id:true,publishedVersion:true}}} as const;
  const packSelect={id:true,authorId:true,createdAt:true,orderMode:true,kidsEligible:true,
    author:{select:{displayName:true}},
    localizations:{where:{locale,status:"PUBLISHED" as const},select:{title:true,description:true}},
    items:{where:{quiz:playableQuizWhere(locale)},select:{quizId:true}}} as const;
  const [quizTotal,packTotal]=await Promise.all([
    db().quiz.count({where:quizWhere}),db().quizPack.count({where:packWhere})
  ]);
  const quizRecent=100,quizOlder=60,packRecent=60,packOlder=40;
  const [latestQuizzes,olderQuizzes,latestPacks,olderPacks]=await Promise.all([
    db().quiz.findMany({where:quizWhere,orderBy:[{updatedAt:"desc"},{id:"desc"}],
      take:quizRecent,select:quizSelect}),
    quizTotal>quizRecent?db().quiz.findMany({where:quizWhere,orderBy:[{updatedAt:"desc"},{id:"desc"}],
      skip:rotatedCatalogOffset(quizTotal,quizRecent,quizOlder,day,rotation),
      take:quizOlder,select:quizSelect}):Promise.resolve([]),
    db().quizPack.findMany({where:packWhere,orderBy:[{updatedAt:"desc"},{id:"desc"}],
      take:packRecent,select:packSelect}),
    packTotal>packRecent?db().quizPack.findMany({where:packWhere,orderBy:[{updatedAt:"desc"},{id:"desc"}],
      skip:rotatedCatalogOffset(packTotal,packRecent,packOlder,day,rotation),
      take:packOlder,select:packSelect}):Promise.resolve([])
  ]);
  const quizzes=[...new Map([...latestQuizzes,...olderQuizzes].map(quiz=>[quiz.id,quiz])).values()];
  const packs=[...new Map([...latestPacks,...olderPacks].map(pack=>[pack.id,pack])).values()];
  const allQuizIds=[...new Set([...quizzes.map(q=>q.id),...packs.flatMap(p=>p.items.map(i=>i.quizId))])];
  const localizations=await db().quizLocalization.findMany({
    where:{quizId:{in:allQuizIds},locale,status:"PUBLISHED",publishedVersion:{not:null}},
    select:{id:true,quizId:true,publishedVersion:true}
  });
  const revisions=localizations.length?await db().quizRevision.findMany({
    where:{OR:localizations.map(l=>({localizationId:l.id,version:l.publishedVersion!}))},
    select:{id:true,quizId:true,title:true,clues:true,promptMediaIds:true}
  }):[];
  const mediaIds=new Set<string>();
  for(const rev of revisions){
    for(const id of Array.isArray(rev.promptMediaIds)?rev.promptMediaIds:[])
      if(typeof id==="string")mediaIds.add(id);
    for(const clue of Array.isArray(rev.clues)?rev.clues:[])
      if(clue&&typeof clue==="object"&&"mediaId" in clue&&typeof clue.mediaId==="string")
        mediaIds.add(clue.mediaId);
  }
  const approvedMedia=mediaIds.size?await db().mediaAsset.findMany({where:{id:{in:[...mediaIds]},
      status:"READY",moderationStatus:"APPROVED",deletedAt:null},select:{id:true}}):[];
  const allowedMedia=new Set(approvedMedia.map(m=>m.id));
  const safeRevisions=new Map<string,{title:string;clueCount:number}>();
  for(const rev of revisions){
    if(!Array.isArray(rev.clues)||!rev.clues.length)continue;
    const used=[
      ...(Array.isArray(rev.promptMediaIds)?rev.promptMediaIds:[]),
      ...rev.clues.map(clue=>clue&&typeof clue==="object"&&"mediaId" in clue?clue.mediaId:null)
    ].filter((x):x is string=>typeof x==="string");
    if(used.some(id=>!allowedMedia.has(id)))continue;
    safeRevisions.set(rev.quizId,{title:rev.title,clueCount:rev.clues.length});
  }
  const validQuizzes=quizzes.filter(q=>safeRevisions.has(q.id));
  const validPacks=packs.filter(pack=>pack.items.some(item=>safeRevisions.has(item.quizId)));
  const qids=validQuizzes.map(q=>q.id), pids=validPacks.map(pack=>pack.id);
  // Never use child-device activity as public adult ranking evidence, even if
  // a guardian's account id is attached to a child-scoped session.
  const qwhere={quizId:{in:qids},locale,userId:{not:null},
    kidSingle:{is:null},OR:[{runId:null},{run:{lane:"GENERAL"}}],
    startedAt:{gte:last30}};
  const pwhere={packId:{in:pids},locale,userId:{not:null},mode:"PACK",lane:"GENERAL",startedAt:{gte:last30}};
  const [q30,p30,pFinished,qReport,pReport,qRatings,pRatings]=await Promise.all([
    db().playSession.groupBy({by:["quizId","userId","status"],where:qwhere,_count:{_all:true}}),
    db().playRun.groupBy({by:["packId","userId","status"],where:pwhere,_count:{_all:true}}),
    db().playRun.groupBy({by:["packId","userId"],where:{...pwhere,status:"FINISHED"},
      _avg:{solved:true,failed:true,targetCount:true}}),
    db().report.groupBy({by:["quizId"],where:{quizId:{in:qids},status:"OPEN",createdAt:{gte:last90}},
      _count:{_all:true}}),
    db().packReport.groupBy({by:["packId"],where:{packId:{in:pids},status:"OPEN",createdAt:{gte:last90}},
      _count:{_all:true}}),
    ratingsForQuizzes(qids,locale),
    packRatingsFor(pids,locale)
  ]);
  const qCounts=metricMap(q30),pCounts=metricMap(p30);
  // Split 14-day window exactly for honest 7-day growth, without extrapolation.
  const [q7,qPrev,p7,pPrev]=await Promise.all([
    db().playSession.groupBy({by:["quizId","userId","status"],where:{...qwhere,startedAt:{gte:last7}},_count:{_all:true}}),
    db().playSession.groupBy({by:["quizId","userId","status"],where:{...qwhere,startedAt:{gte:last14,lt:last7}},_count:{_all:true}}),
    db().playRun.groupBy({by:["packId","userId","status"],where:{...pwhere,startedAt:{gte:last7}},_count:{_all:true}}),
    db().playRun.groupBy({by:["packId","userId","status"],where:{...pwhere,startedAt:{gte:last14,lt:last7}},_count:{_all:true}})
  ]);
  const q7m=metricMap(q7),qPrevm=metricMap(qPrev),p7m=metricMap(p7),pPrevm=metricMap(pPrev);
  const qBad=new Set(qReport.filter(x=>x._count._all>=3).map(x=>x.quizId));
  const pBad=new Set(pReport.filter(x=>x._count._all>=3).map(x=>x.packId));
  const packFail=new Map<string,{sum:number;players:number}>();
  for(const row of pFinished){
    if(!row.packId||!row.userId)continue;
    const ratio=packDifficulty(row._avg.solved??0,row._avg.failed??0);
    if(ratio===null)continue;
    const old=packFail.get(row.packId)??{sum:0,players:0};
    old.sum+=ratio;old.players++;
    packFail.set(row.packId,old);
  }
  const rows:Array<{card:DiscoveryCard;metrics:ReturnType<typeof metricMap>;recent:ReturnType<typeof metricMap>;prior:ReturnType<typeof metricMap>;bad:boolean;hardSample:number}>=[];

  for(const quiz of validQuizzes){
    const value=safeRevisions.get(quiz.id)!;
    const item=qCounts.get(quiz.id);
    const completed=item?.completed.size??0;
    // One participant counts once. Solving on a repeat attempt does not inflate difficulty.
    const solved=item?.solved.size??0;
    rows.push({card:{id:quiz.id,type:"QUIZ",title:value.title,
      subtitle:quiz.answerType,creator:quiz.author.displayName,questionCount:1,
      ratings:qRatings.get(quiz.id)!,started:count(qCounts,quiz.id,"starts"),
      completed,difficultyPercent:completed>=10?Math.round(100*(1-solved/completed)):null,
      createdAt:quiz.createdAt.toISOString()},
      metrics:qCounts,recent:q7m,prior:qPrevm,bad:qBad.has(quiz.id),hardSample:completed});
  }
  for(const pack of validPacks){
    const score=packFail.get(pack.id);
    rows.push({card:{id:pack.id,type:"PACK",title:pack.localizations[0]?.title??"",
      subtitle:pack.localizations[0]?.description??"",creator:pack.author.displayName,
      questionCount:pack.items.filter(i=>safeRevisions.has(i.quizId)).length,orderMode:pack.orderMode,
      kidsEligible:pack.kidsEligible,ratings:pRatings.get(pack.id)!,started:count(pCounts,pack.id,"starts"),
      completed:count(pCounts,pack.id,"completed"),
      difficultyPercent:score&&score.players>=10?Math.round(score.sum/score.players):null,
      createdAt:pack.createdAt.toISOString()},
      metrics:pCounts,recent:p7m,prior:pPrevm,bad:pBad.has(pack.id),
      hardSample:score?.players??0});
  }
  const featured=rows.filter(r=>!r.bad);
  // Dedicated pack lanes keep packs visible above individual questions on Discover.
  // Popularity always requires verified unique players; new_packs is an
  // explicitly unranked fallback when a newly launched catalog has no activity.
  const packRows=featured.filter(r=>r.card.type==="PACK");
  const sections:DiscoverySection[]=[
    {key:"popular_packs",basis:"Verified distinct adult players and completions, last 30 days; minimum three players",
      items:takeDiverse(packRows.filter(r=>r.card.started>=3)
        .map(r=>({card:r.card,score:r.card.started+1.5*r.card.completed})),6,3)},
    {key:"new_packs",basis:"Eligible published packs, ordered by creation time; not a popularity ranking",
      items:takeDiverse(packRows.map(r=>({card:r.card,score:Date.parse(r.card.createdAt)})),6,3)},
    {key:"surprise",basis:"Rotating selection of eligible published packs and questions; not a popularity ranking",
      items:mixDiscoveryCards(featured.map(row=>row.card),day,rotation)},
    {key:"trending",basis:"Growth in distinct signed-in players, last 7 days versus previous 7",
      items:takeDiverse(featured.filter(r=>{
        const recent=count(r.recent,r.card.id,"starts"),prior=count(r.prior,r.card.id,"starts");
        return recent>=5 && recent>prior+1;
      }).map(r=>({card:r.card,score:
        (count(r.recent,r.card.id,"starts")-count(r.prior,r.card.id,"starts"))+
        0.25*r.card.completed})))},
    {key:"popular",basis:"Distinct signed-in players and completions, last 30 days",
      items:takeDiverse(featured.filter(r=>r.card.started>=3)
        .map(r=>({card:r.card,score:r.card.started+1.5*r.card.completed})))},
    {key:"highly_rated",basis:"Positive/negative feedback with Wilson confidence adjustment, minimum 5 votes",
      items:takeDiverse(featured.filter(r=>r.card.ratings.total>=5).map(r=>({
        card:r.card,score:wilsonPositiveScore(r.card.ratings.positive,r.card.ratings.negative)
      })))},
    {key:"difficult",basis:"Incorrect answers from verified completed plays, minimum 10 distinct players",
      items:takeDiverse(featured.filter(r=>r.hardSample>=10&&r.card.difficultyPercent!==null)
        .map(r=>({card:r.card,score:r.card.difficultyPercent!})))},
    {key:"new",basis:"Recently created, published and currently eligible content",
      items:takeDiverse(featured.map(r=>({card:r.card,
        score:Date.parse(r.card.createdAt)})))}
  ];
  return {locale,sections,windowDays:30,note:"Activity-based rankings use distinct signed-in adult players within a bounded eligible catalog; the surprise lane rotates published content and is not a popularity ranking."};
}
