import { createHash } from "node:crypto";
import type { Actor } from "./auth";
import { fail } from "./auth";
import { db } from "./db";
import { checkedRun, sessionToken } from "./runs";
import { RunSyncBusyError, RUN_SYNC_MAX_ATTEMPTS, withSerializableWriteRetry } from "./run-sync-retry";
import { getPlaySession, playStart } from "./play";
import { previewUrl } from "./storage";
import { publicAnswerFormat, firstAuthoredChoice } from "./answer-options";
import type { LocalAnswer, LocalQuestion } from "@quizdip/domain";

type Result = {position:number;cluesUsed:number;status:"SOLVED"|"FAILED";score:number;firstChoice?:string};
function hashed(value:string){return createHash("sha256").update(value).digest("hex");}
function allowedQuiz(quiz:any,revision:any,lane:string,locale:string){
  if(!quiz||quiz.publication!=="PUBLISHED"||quiz.safetyStatus!=="ACTIVE"||
     !revision||revision.localization?.locale!==locale||
     revision.localization.status!=="PUBLISHED")
    fail(409,"question_unavailable","This question is no longer playable");
  if(lane==="KIDS"&&(!quiz.kidsEligible||quiz.kidsReviewStatus!=="APPROVED"||
     !["ORIGINAL","LEGACY"].includes(revision.localization.origin)))
    fail(403,"kid_content_withdrawn","This question is no longer approved for Kids");
}
function questionData(row:any, seed:string):LocalQuestion & {position:number;responseMode:string;options?:string[]} {
  const revision=row.revision, answer=revision.answer as LocalAnswer;
  const choices=publicAnswerFormat(answer,seed);
  return {position:row.position,quizId:row.quizId,revisionId:revision.id,
    title:revision.title,prompt:revision.prompt,explanation:revision.explanation ?? "",
    promptMediaIds:revision.promptMediaIds as string[],
    clues:revision.clues as LocalQuestion["clues"],answer:{...answer,
      ...(choices.options?{options:choices.options}:{})},
    ...choices};
}
async function checkMedia(revisions:any[]){
  const ids=new Set<string>();
  for(const revision of revisions){
    for(const id of (Array.isArray(revision.promptMediaIds)?revision.promptMediaIds:[]))
      if(typeof id==="string")ids.add(id);
    for(const clue of (Array.isArray(revision.clues)?revision.clues:[]))
      if(typeof clue?.mediaId==="string")ids.add(clue.mediaId);
  }
  if(!ids.size)return;
  const count=await db().mediaAsset.count({where:{id:{in:[...ids]},status:"READY",
    moderationStatus:"APPROVED",deletedAt:null}});
  if(count!==ids.size)fail(409,"media_unavailable","A media clue is currently unavailable");
}
export async function localRunBundle(p:Record<string,any>,actor:Actor|null){
  const run=await checkedRun(p.runId,p.runToken,actor);
  const rows=await db().playRunQuestion.findMany({where:{runId:run.id},orderBy:{position:"asc"},
    include:{quiz:true,revision:{include:{localization:true}}}});
  if(!rows.length)fail(409,"no_questions","There are no questions in this run");
  for(const row of rows)allowedQuiz(row.quiz,row.revision,run.lane,run.locale);
  await checkMedia(rows.map(row=>row.revision));
  const sessions=await db().playSession.findMany({where:{runId:run.id},
    select:{roundIndex:true,usedClues:true,wrongGuesses:true,score:true,status:true}});
  return {runId:run.id,mode:run.mode,lane:run.lane,locale:run.locale,
    total:run.targetCount??null,packId:run.packId,packVersion:run.packVersion,
    status:run.status,completed:run.currentIndex,score:run.score,
    questions:rows.map(row=>questionData(row,p.runId+":"+row.position)),
    progress:sessions.filter(s=>s.roundIndex!==null).map(s=>({
      position:s.roundIndex!,clueIndex:s.usedClues,wrongGuesses:s.wrongGuesses,
      status:s.status,score:s.score,mustReveal:s.status==="ACTIVE"&&s.wrongGuesses>=s.usedClues
    }))};
}
export async function localRunSync(p:Record<string,any>,actor:Actor|null){
  const run=await checkedRun(p.runId,p.runToken,actor);
  const questions=await db().playRunQuestion.findMany({where:{runId:run.id},
    select:{position:true,quizId:true,revisionId:true}});
  const lookup=new Map(questions.map(q=>[q.position,q]));
  for(const result of p.results as Result[])if(!lookup.has(result.position))
    fail(400,"invalid_round","Question is not part of this run");
  // A concurrent device, browser tab or history reconciliation can write this run.
  // Retry the entire Serializable transaction, not just its final update.
  try {
    return await withSerializableWriteRetry(()=>db().$transaction(async tx=>{
    for(const result of p.results){
      const q=lookup.get(result.position)!;
      const existing=await tx.playSession.findUnique({where:{runId_roundIndex:{
        runId:run.id,roundIndex:result.position}}});
      if(existing?.status==="SOLVED"||existing?.status==="FAILED")continue;
      const revision=await tx.quizRevision.findUnique({where:{id:q.revisionId},select:{clues:true,answer:true}});
      const firstChoice=firstAuthoredChoice(revision?.answer,result.firstChoice);
      if(result.firstChoice && firstChoice===null)
        fail(400,"invalid_choice","Submitted choice is not an authored option");
      const count=Array.isArray(revision?.clues)?revision.clues.length:1;
      const used=count===0?0:Math.min(Math.max(1,result.cluesUsed),count);
      const score=result.status==="SOLVED"?Math.max(0,Math.min(100,Math.round(result.score))):0;
      if(existing){
        await tx.playSession.updateMany({where:{id:existing.id,status:"ACTIVE"},data:{
          usedClues:used,wrongGuesses:result.status==="FAILED"?used:0,
          status:result.status,score,finishedAt:new Date(),
          ...(existing.firstChoice===null&&firstChoice!==null?{firstChoice}:{})
        }});
      }else{
        await tx.playSession.create({data:{
          quizId:q.quizId,revisionId:q.revisionId,runId:run.id,roundIndex:result.position,
          locale:run.locale,userId:run.userId,
          tokenHash:hashed(sessionToken(p.runToken,run.id,result.position)),
          expiresAt:run.expiresAt,usedClues:used,
          wrongGuesses:result.status==="FAILED"?used:0,
          status:result.status,score,finishedAt:new Date(),
          ...(firstChoice!==null?{firstChoice}:{})
        }});
      }
    }
    const sessions=await tx.playSession.findMany({where:{runId:run.id},
      select:{roundIndex:true,status:true,score:true}});
    const done=new Map(sessions.filter(s=>s.status==="SOLVED"||s.status==="FAILED").map(s=>[s.roundIndex,s]));
    let completed=0;
    while(done.has(completed))completed++;
    const score=[...done.values()].reduce((n,s)=>n+s.score,0);
    const solved=[...done.values()].filter(s=>s.status==="SOLVED").length;
    const failed=[...done.values()].filter(s=>s.status==="FAILED").length;
    const finished=run.mode!=="INFINITE"&&completed>=questions.length;
    // Replayed full snapshots are common (history recovery, multi-device resume).
    // Do not write an unchanged PlayRun row: unnecessary writes cause P2034
    // conflicts with other syncs and history reconciliation.
    const current=await tx.playRun.findUniqueOrThrow({where:{id:run.id},
      select:{currentIndex:true,score:true,solved:true,failed:true,status:true}});
    if(current.currentIndex!==completed||current.score!==score||
       current.solved!==solved||current.failed!==failed||
       (finished&&current.status!=="FINISHED")){
      await tx.playRun.update({where:{id:run.id},data:{
        currentIndex:completed,score,solved,failed,
        ...(finished?{status:"FINISHED",completedAt:new Date()}:{})
      }});
    }
    return {runId:run.id,completed,score,solved,failed,
      status:finished?"FINISHED":current.status};
    },{isolationLevel:"Serializable",maxWait:10000,timeout:20000}),{
      onRetry:(code,attempt,waitMs)=>console.warn("[QuizDip] run result write conflict",{
        runId:run.id,code,attempt,waitMs
      })
    });
  } catch(error) {
    if(error instanceof RunSyncBusyError){
      console.error("[QuizDip] run result sync exhausted retries",{
        runId:run.id,code:error.lastConflictCode,attempts:RUN_SYNC_MAX_ATTEMPTS
      });
      fail(503,"run_sync_busy","Result storage is temporarily busy. Please retry.");
    }
    throw error;
  }
}
export async function localSingleBundle(p:Record<string,any>,actor:Actor|null){
  const session=await getPlaySession(p,actor,{allowCompletedRun:true});
  const quiz=await db().quiz.findUnique({where:{id:session.quizId}});
  allowedQuiz(quiz,session.revision,actor?.childScope?"KIDS":"GENERAL",session.locale);
  await checkMedia([session.revision]);
  return {sessionId:session.id,sessionToken:p.sessionToken,
    question:questionData({position:0,quizId:session.quizId,revision:session.revision},session.id),
    progress:{position:0,clueIndex:session.usedClues,wrongGuesses:session.wrongGuesses,
      status:session.status,score:session.score,
      mustReveal:session.status==="ACTIVE"&&session.wrongGuesses>=session.usedClues}};
}
export async function localSingleStart(p:Record<string,any>,actor:Actor|null){
  const session=await playStart(p,actor);
  return {...session,...await localSingleBundle({sessionId:session.sessionId,sessionToken:session.sessionToken},actor)};
}
export async function localSingleSync(p:Record<string,any>,actor:Actor|null){
  const session=await getPlaySession(p,actor,{allowCompletedRun:true});
  if(session.runId)fail(400,"invalid_session","Use run synchronization for run questions");
  if(session.status==="ACTIVE"){
    const firstChoice=firstAuthoredChoice(session.revision.answer,p.firstChoice);
    if(p.firstChoice && firstChoice===null)
      fail(400,"invalid_choice","Submitted choice is not an authored option");
    const clues=Array.isArray(session.revision.clues)?session.revision.clues.length:1;
    const used=clues===0?0:Math.min(Math.max(1,p.cluesUsed),clues);
    await db().playSession.updateMany({where:{id:session.id,status:"ACTIVE"},data:{
      usedClues:used,wrongGuesses:p.status==="FAILED"?used:0,
      status:p.status,score:p.status==="SOLVED"?Math.max(0,Math.min(100,Math.round(p.score))):0,
      finishedAt:new Date(),
      ...(session.firstChoice===null&&firstChoice!==null?{firstChoice}:{})
    }});
  }
  return {saved:true};
}
async function signedMedia(revision:any,mediaId:string){
  const clues=revision.clues as Array<{mediaId?:string}>;
  const prompt=revision.promptMediaIds as string[];
  if(!prompt?.includes(mediaId)&&!clues?.some(c=>c.mediaId===mediaId))
    fail(403,"media_not_in_question","Media is not used by this question");
  const media=await db().mediaAsset.findUnique({where:{id:mediaId}});
  if(!media||media.deletedAt||media.status!=="READY"||media.moderationStatus!=="APPROVED")
    fail(404,"media_unavailable","Media is unavailable");
  return {mediaId:media.id,url:await previewUrl(media.storageKey,media.mimeType),
    expiresInSeconds:60,kind:media.kind,mimeType:media.mimeType};
}
export async function localRunMedia(p:Record<string,any>,actor:Actor|null){
  const run=await checkedRun(p.runId,p.runToken,actor);
  const round=await db().playRunQuestion.findUnique({where:{runId_position:{
    runId:run.id,position:p.position}},include:{revision:true}});
  if(!round)fail(404,"round_not_found","Question was not found");
  return signedMedia(round.revision,p.mediaId);
}
export async function localSingleMedia(p:Record<string,any>,actor:Actor|null){
  const session=await getPlaySession(p,actor,{allowCompletedRun:true});
  return signedMedia(session.revision,p.mediaId);
}
