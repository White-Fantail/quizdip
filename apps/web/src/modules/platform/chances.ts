import { createHash } from "node:crypto";
import { normalizeAnswer } from "@quizdip/domain";
import { db } from "./db";
import { fail, requireActor, type Actor } from "./auth";
import { checkedRun, sessionToken } from "./runs";

export type ChanceHint =
  | {kind:"remove-choice";option:string}
  | {kind:"reveal-letter";index:number;character:string};

const MAX_BALANCE=5;
const MAX_PER_RUN=2;
function day(){return new Date().toISOString().slice(0,10);}
function deterministicIndex(seed:string,count:number){
  return createHash("sha256").update(seed).digest().readUInt32BE(0)%count;
}
function hintFor(answer:{canonical:string;aliases?:string[];responseMode?:string;options?:string[]},seed:string):ChanceHint{
  if(answer.responseMode==="multiple-choice"){
    const wrong=(answer.options??[]).filter(s=>normalizeAnswer(s)!==normalizeAnswer(answer.canonical)&&
      !(answer.aliases??[]).some(alias=>normalizeAnswer(alias)===normalizeAnswer(s)));
    if((answer.options??[]).length<3||wrong.length===0)
      fail(409,"chance_unavailable","This question does not support eliminating a choice");
    return {kind:"remove-choice",option:wrong[deterministicIndex(seed,wrong.length)]};
  }
  const letters=[...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(answer.canonical)].map(x=>x.segment);
  const candidates=letters.map((s,i)=>({s,i})).filter(x=>/[\p{L}\p{N}]/u.test(x.s));
  if(candidates.length<3)fail(409,"chance_unavailable","This answer is too short for a letter chance");
  const choice=candidates[deterministicIndex(seed,candidates.length)];
  return {kind:"reveal-letter",index:choice.i,character:choice.s};
}
export async function chanceBalance(actor:Actor|null){
  if(!actor||actor.childScope)return {authenticated:false,balance:0,cap:MAX_BALANCE,daily:1,firstGrant:3};
  const today=day();
  const row=await db().user.findUniqueOrThrow({where:{id:actor.id},select:{chanceBalance:true,chanceGrantDay:true}});
  if(row.chanceGrantDay!==today){
    const amount=row.chanceGrantDay===null?0:Math.max(0,Math.min(1,MAX_BALANCE-row.chanceBalance));
    await db().user.updateMany({where:{id:actor.id,chanceGrantDay:row.chanceGrantDay},
      data:{chanceGrantDay:today,...(amount?{chanceBalance:{increment:amount}}:{})}});
  }
  const fresh=await db().user.findUniqueOrThrow({where:{id:actor.id},select:{chanceBalance:true}});
  return {authenticated:true,balance:fresh.chanceBalance,cap:MAX_BALANCE,daily:1,firstGrant:3};
}
export async function useRunChance(p:Record<string,any>,actor:Actor|null){
  const user=requireActor(actor);
  if(user.childScope)fail(403,"chance_unavailable","Chances are not available in Kids play");
  const run=await checkedRun(p.runId,p.runToken,actor);
  if(run.userId!==user.id||run.mode!=="PACK"||run.lane!=="GENERAL"||run.scoringVersion!==2)
    fail(403,"chance_unavailable","Chances apply only to signed-in general quiz pack games");
  if(run.status!=="ACTIVE"||run.currentIndex!==p.position||run.expiresAt.getTime()<=Date.now())
    fail(409,"chance_round_unavailable","Finish syncing previous questions before using a chance");
  return db().$transaction(async tx=>{
    const freshRun=await tx.playRun.findUniqueOrThrow({where:{id:run.id}});
    if(freshRun.currentIndex!==p.position||freshRun.status!=="ACTIVE")
      fail(409,"chance_round_unavailable","This round has changed");
    const round=await tx.playRunQuestion.findUnique({where:{runId_position:{runId:run.id,position:p.position}},
      include:{revision:true}});
    if(!round)fail(404,"round_not_found","Question not found in this run");
    const token=sessionToken(p.runToken,run.id,p.position);
    let session=await tx.playSession.findUnique({where:{runId_roundIndex:{runId:run.id,roundIndex:p.position}}});
    if(session?.chanceHint){
      const balance=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{chanceBalance:true}});
      return {hint:JSON.parse(session.chanceHint) as ChanceHint,balance:balance.chanceBalance,chancesUsed:freshRun.chancesUsed};
    }
    if((session&& (session.status!=="ACTIVE"||session.wrongGuesses!==0||session.hadWrongGuess))||
       freshRun.chancesUsed>=MAX_PER_RUN)
      fail(409,"chance_unavailable","Chance must be used before your first guess, maximum two per pack");
    const answer=round.revision.answer as {canonical:string;aliases?:string[];responseMode?:string;options?:string[]};
    const hint=hintFor(answer,run.id+":"+p.position+":"+round.revisionId);
    const changed=await tx.user.updateMany({where:{id:user.id,chanceBalance:{gt:0}},
      data:{chanceBalance:{decrement:1}}});
    if(changed.count!==1)fail(409,"no_chances","No chances remaining");
    const counted=await tx.playRun.updateMany({where:{id:run.id,chancesUsed:{lt:MAX_PER_RUN}},
      data:{chancesUsed:{increment:1}}});
    if(counted.count!==1)fail(409,"run_chance_limit","Chance limit reached in this pack");
    if(session){
      const applied=await tx.playSession.updateMany({where:{id:session.id,status:"ACTIVE",chanceHint:null},
        data:{chanceHint:JSON.stringify(hint)}});
      if(applied.count!==1)fail(409,"chance_conflict","Chance was already used");
    }else{
      session=await tx.playSession.create({data:{
        quizId:round.quizId,revisionId:round.revisionId,userId:user.id,runId:run.id,
        roundIndex:p.position,locale:run.locale,tokenHash:createHash("sha256").update(token).digest("hex"),
        usedClues:Array.isArray(round.revision.clues)&&round.revision.clues.length===0?0:1,
        expiresAt:run.expiresAt,chanceHint:JSON.stringify(hint)
      }});
    }
    const balance=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{chanceBalance:true}});
    return {hint,balance:balance.chanceBalance,chancesUsed:freshRun.chancesUsed+1};
  },{isolationLevel:"Serializable"});
}
