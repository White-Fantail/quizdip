import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { ratingsForQuizzes, ratingsForQuiz, myRatingForQuiz, ratingAccess } from "./ratings";
import { fail, requireActor, type Actor } from "./auth";
import { selectUnseen } from "./unseen-questions";
import { runTargetCount } from "./run-length";
import { orderPackQuestions } from "./pack-order";
import { playableQuizWhere } from "./content-locale";
import { safePack } from "./feature-eligibility";
import { publicAnswerFormat } from "./answer-options";
import type { Locale } from "../../i18n/core";

export type Lane = "GENERAL" | "KIDS";
export type RunMode = "RANDOM_FIVE" | "INFINITE" | "PACK";
export function eligibleQuizWhere(lane: Lane): Record<string,unknown> {
  return { publication: "PUBLISHED", ...(lane === "KIDS"
    ? { safetyStatus: "ACTIVE", kidsEligible: true, kidsReviewStatus:"APPROVED" }
    : { safetyStatus: "ACTIVE" }) };
}
function hash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function secret(): string {
  const s = process.env.PLAY_RUN_SECRET;
  if (!s || s.length < 32) fail(503, "play_unconfigured", "PLAY_RUN_SECRET must be configured securely");
  return s;
}
function authToken(runId: string, userId: string): string {
  return createHmac("sha256", secret()).update("clupio:run:v1:" + runId + ":" + userId).digest("base64url");
}
export function sessionToken(runToken: string, runId: string, index: number): string {
  return createHmac("sha256", runToken).update("clupio:round:v1:" + runId + ":" + index).digest("base64url");
}
function matchingToken(provided: string, expectedHash: string): boolean {
  const a=Buffer.from(hash(provided), "hex"), b=Buffer.from(expectedHash,"hex");
  return a.length === b.length && timingSafeEqual(a,b);
}
export async function checkedRun(id: string, token: string, actor: Actor|null) {
  const run=await db().playRun.findUnique({where:{id}});
  if (!run || !matchingToken(token,run.tokenHash)) fail(404,"run_not_found","Play run was not found");
  if (run.userId && run.userId!==actor?.id) fail(403,"forbidden","Run belongs to another account");
  const kidBinding=await db().kidPlayRun.findUnique({where:{runId:id}});
  if(kidBinding && (actor?.childScope?.profileId!==kidBinding.profileId ||
      actor?.childScope?.deviceId!==kidBinding.deviceId))
    fail(403,"kid_play_forbidden","A child-only run requires its authorized device");
  if (run.status === "ACTIVE" && run.expiresAt.getTime() <= Date.now())
    fail(410,"run_expired","This play run has expired");
  return run;
}
async function pinnedMediaApproved(revisions: Array<{clues: unknown;promptMediaIds:unknown}>): Promise<boolean> {
  const ids=new Set<string>();
  for (const revision of revisions) {
    for (const id of Array.isArray(revision.promptMediaIds)?revision.promptMediaIds:[]) {
      if(typeof id==="string") ids.add(id);
    }
    for (const clue of Array.isArray(revision.clues)?revision.clues:[]) {
      if(clue && typeof clue==="object" && "mediaId" in clue && typeof clue.mediaId==="string")
        ids.add(clue.mediaId);
    }
  }
  if(!ids.size) return true;
  const approved=await db().mediaAsset.count({where:{
    id:{in:[...ids]},status:"READY",moderationStatus:"APPROVED",deletedAt:null
  }});
  return approved===ids.size;
}
function shuffle<T>(items:T[]):T[] {
  const out=[...items];
  for(let i=out.length-1;i>0;i--) {
    // Use Node crypto instead of Math.random for unbiased random practice selection.
    const bytes=randomBytes(4).readUInt32BE(0);
    const j=bytes%(i+1);[out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
async function userExcludedQuestions(userId:string):Promise<string[]> {
  const [sessions,allocated]=await Promise.all([
    db().playSession.findMany({where:{userId},select:{quizId:true}}),
    db().playRunQuestion.findMany({where:{run:{userId}},select:{quizId:true}})
  ]);
  return [...new Set([...sessions,...allocated].map(row=>row.quizId))];
}
async function randomChoices(lane:Lane,locale:Locale,count:number,avoid:string[]=[],allowEmpty=false) {
  const pool=await db().quiz.findMany({where:playableQuizWhere(locale,lane),
    select:{id:true,localizations:{where:{locale,status:"PUBLISHED"},select:{
      id:true,currentVersion:true,publishedVersion:true,
      revisions:{select:{id:true,version:true}}
    }}}});
  const eligible=pool.filter(q=>{
    const loc=q.localizations[0];
    return loc?.publishedVersion != null && loc.revisions.some(r=>r.version===loc.publishedVersion);
  });
  const choice=shuffle(selectUnseen(eligible,avoid)).slice(0,count);
  if(choice.length<count) {
    if(allowEmpty) return [];
    fail(409,"not_enough_questions",count===5
      ? "Not enough new quizzes in the selected language to start five questions."
      : "No unseen quizzes remain in the selected language.");
  }
  return choice.map(q=>({quizId:q.id,revisionId:q.localizations[0].revisions.find(r=>r.version===q.localizations[0].publishedVersion)!.id}));
}
/** Build a complete, localized pack snapshot under one database transaction.
 * Members, positions and published revision ids never change within a started run.
 */
async function startPackRun(p:Record<string,any>,actor:Actor|null) {
  if(p.lane!=="GENERAL" || actor?.childScope)
    fail(403,"pack_kids_unavailable","Pack play is not yet enabled for child devices");
  if(!p.packId)fail(400,"pack_required","Choose a quiz pack");
  const locale=p.locale as Locale;
  const safe=await safePack(p.packId,locale,"GENERAL");
  // A signed-in player can resume on any device: their run capability is
  // deterministically derived server-side, never obtained from a public URL.
  const current=await db().quizPack.findFirst({
    where:{id:p.packId,publication:"PUBLISHED",safetyStatus:"ACTIVE",localizations:{some:{locale,status:"PUBLISHED"}}},
    select:{id:true,currentVersion:true}
  });
  if(!current)fail(404,"pack_unavailable","Quiz pack is not published in this language");
  if(p.resumeRunId){
    if(!actor||p.restart)fail(403,"resume_forbidden","Sign in to resume this play run");
    const selected=await db().playRun.findFirst({where:{
      id:p.resumeRunId,packId:current.id,userId:actor.id,mode:"PACK",lane:"GENERAL",
      locale,status:"ACTIVE",expiresAt:{gt:new Date()}
    }});
    if(!selected)fail(404,"resume_unavailable","This play run can no longer be resumed");
    return {...runSummary(selected),runToken:authToken(selected.id,actor.id),resumed:true};
  }
  if(actor && !p.restart){
    const active=await db().playRun.findFirst({where:{
      packId:current.id,userId:actor.id,
      lane:"GENERAL",locale,mode:"PACK",status:"ACTIVE",expiresAt:{gt:new Date()}
    },orderBy:{startedAt:"desc"}});
    if(active){
      return {...runSummary(active),runToken:authToken(active.id,actor.id),resumed:true};
    }
  }
  const id=randomUUID();
  const runToken=actor?authToken(id,actor.id):randomBytes(32).toString("base64url");
  const expiry=new Date(Date.now()+30*86400000);
  return db().$transaction(async tx=>{
    const pack=await tx.quizPack.findFirst({
      where:{id:p.packId,publication:"PUBLISHED",safetyStatus:"ACTIVE",
        currentVersion:safe.packVersion,
        localizations:{some:{locale,status:"PUBLISHED"}}},
      include:{items:{orderBy:{position:"asc"},select:{quizId:true,position:true}}}
    });
    if(!pack||!pack.items.length||pack.items.length>100)
      fail(409,"pack_unavailable","Quiz pack has no playable questions");
    // Snapshot only the currently safe members. Keep the stored composition unchanged.
    const ids=safe.items.map(item=>item.quizId);
    if(new Set(ids).size!==ids.length)
      fail(409,"pack_invalid","Quiz pack contains duplicate questions");
    const playable=await tx.quiz.findMany({where:{id:{in:ids},...playableQuizWhere(locale)},
      select:{id:true}});
    if(playable.length!==ids.length)
      fail(409,"pack_unavailable","Pack membership changed during start; retry");
    const localizations=await tx.quizLocalization.findMany({
      where:{quizId:{in:ids},locale,status:"PUBLISHED"},
      select:{id:true,quizId:true,publishedVersion:true,
        revisions:{select:{id:true,version:true}}}
    });
    const pinned=new Map<string,string>();
    for(const localization of localizations){
      const rev=localization.revisions.find(r=>r.version===localization.publishedVersion);
      if(rev)pinned.set(localization.quizId,rev.id);
    }
    if(pinned.size!==ids.length)
      fail(409,"pack_locale_incomplete","All pack questions need a published language revision");
    const revisions=await tx.quizRevision.findMany({
      where:{id:{in:[...pinned.values()]}},
      select:{id:true,clues:true,answer:true,promptMediaIds:true}
    });
    if(revisions.length!==ids.length || revisions.some(r=>!Array.isArray(r.clues)||(r.clues.length===0&&(r.answer as {responseMode?:string})?.responseMode!=="multiple-choice")))
      fail(409,"pack_revision_unavailable","A pack question has no usable published clues");
    const mediaIds=new Set<string>();
    for(const revision of revisions){
      for(const mediaId of Array.isArray(revision.promptMediaIds)?revision.promptMediaIds:[])
        if(typeof mediaId==="string")mediaIds.add(mediaId);
      for(const clue of Array.isArray(revision.clues)?revision.clues:[])
        if(clue && typeof clue==="object" && "mediaId" in clue && typeof clue.mediaId==="string")
          mediaIds.add(clue.mediaId);
    }
    if(mediaIds.size){
      const approved=await tx.mediaAsset.count({where:{id:{in:[...mediaIds]},
        status:"READY",moderationStatus:"APPROVED",deletedAt:null}});
      if(approved!==mediaIds.size)
        fail(409,"pack_media_unavailable","A pack question uses unavailable media");
    }
    // Shuffle exactly once when the run is created; persistence pins this order.
    // Creator order remains the default for every existing pack.
    const orderedItems=orderPackQuestions(pack.items.filter(item=>ids.includes(item.quizId)),
      pack.orderMode as "CREATOR"|"RANDOM");
    const run=await tx.playRun.create({data:{
      id,mode:"PACK",lane:"GENERAL",locale,userId:actor?.id,scoringVersion:2,
      packId:pack.id,packVersion:pack.currentVersion,targetCount:ids.length,
      tokenHash:hash(runToken),expiresAt:expiry,
      questions:{create:orderedItems.map((item,index)=>({
        position:index,quizId:item.quizId,revisionId:pinned.get(item.quizId)!
      }))}
    }});
    return {...runSummary(run),runToken,resumed:false};
  },{isolationLevel:"Serializable"});
}
export async function runStart(p:Record<string,any>,actor:Actor|null) {
  const mode=p.mode as RunMode, lane=p.lane as Lane, locale=p.locale as Locale;
  if(mode==="PACK")return startPackRun(p,actor);
  if(mode!=="RANDOM_FIVE"&&mode!=="INFINITE")
    fail(400,"invalid_run_mode","Choose quick-five, continuous random, or a quiz pack");
  const avoid=[
    ...(actor?await userExcludedQuestions(actor.id):[]),...(p.avoidQuizIds||[])
  ];
  const questions=await randomChoices(lane,locale,mode==="RANDOM_FIVE"?5:1,avoid);
  const id=randomUUID();
  const runToken=actor?authToken(id,actor.id):randomBytes(32).toString("base64url");
  const expiresAt=new Date(Date.now()+(mode==="INFINITE"?7:2)*86400000);
  const run=await db().playRun.create({data:{
    id,mode,lane,locale,userId:actor?.id,
    tokenHash:hash(runToken),expiresAt,targetCount:mode==="INFINITE"?null:questions.length,
    questions:{create:questions.map((q,index)=>({...q,position:index}))}
  }});
  return {...runSummary(run),runToken,resumed:false};
}
function runSummary(run:any) {
  return {runId:run.id,mode:run.mode,lane:run.lane,locale:run.locale,status:run.status,
    completed:run.currentIndex,total:runTargetCount(run),
    packId:run.packId??null,packVersion:run.packVersion??null,
    score:run.score,solved:run.solved,failed:run.failed,
    scoringVersion:run.scoringVersion,currentCombo:run.currentCombo,bestCombo:run.bestCombo,chancesUsed:run.chancesUsed,
    completedAt:run.completedAt};
}
/** Advance a general pack past a quiz withdrawn mid-run, without awarding a failure.
 * Its frozen total represents slots at start; restrictions do not reveal answers.
 */
async function skipWithdrawnPackRound(run:any,p:Record<string,any>,actor:Actor|null):Promise<any>{
  const target=runTargetCount(run);
  if(target===null)fail(409,"invalid_pack_run","Pack run has no finite target count");
  const last=run.currentIndex+1>=target;
  await db().playRun.updateMany({where:{id:run.id,mode:"PACK",lane:"GENERAL",
    status:"ACTIVE",currentIndex:run.currentIndex},
    data:{currentIndex:{increment:1},...(last?{status:"FINISHED",completedAt:new Date()}:{})}});
  return runCurrent(p,actor);
}
export async function runCurrent(p:Record<string,any>,actor:Actor|null):Promise<any> {
  const run=await checkedRun(p.runId,p.runToken,actor);
  if (p.locale && run.locale!==p.locale) fail(409,"locale_mismatch","Run language cannot be changed mid-game");
  if(run.status==="FINISHED") return runSummary(run);
  if(run.mode==="PACK"){
    if(!run.packId || !await db().quizPack.findFirst({where:{id:run.packId,
      publication:"PUBLISHED",safetyStatus:"ACTIVE",localizations:{some:{locale:run.locale,status:"PUBLISHED"}}},
      select:{id:true}}))
      fail(409,"pack_unavailable","Quiz pack is no longer published");
  }
  let round=await db().playRunQuestion.findUnique({where:{runId_position:{runId:run.id,position:run.currentIndex}}});
  if(!round && run.mode==="INFINITE") {
    const old=await db().playRunQuestion.findMany({where:{runId:run.id},select:{quizId:true}});
    const exclude=[...old.map(o=>o.quizId),...(run.userId?await userExcludedQuestions(run.userId):[]),
      ...(p.avoidQuizIds||[])];
    const chosen=(await randomChoices(run.lane as Lane,run.locale as Locale,1,exclude,true))[0];
    if(!chosen) {
      await db().playRun.updateMany({where:{id:run.id,status:"ACTIVE",currentIndex:run.currentIndex},
        data:{status:"FINISHED",completedAt:new Date()}});
      const done=await db().playRun.findUniqueOrThrow({where:{id:run.id}});
      return {...runSummary(done),exhausted:done.status==="FINISHED",
        message:"아직 풀지 않은 문제를 모두 발견했어요. 새로운 퀴즈가 공개되면 다시 즐겨 주세요."};
    }
    try {
      round=await db().playRunQuestion.create({data:{runId:run.id,position:run.currentIndex,...chosen}});
    } catch(error:any) {
      if(error?.code!=="P2002") throw error;
      round=await db().playRunQuestion.findUnique({where:{runId_position:{runId:run.id,position:run.currentIndex}}});
    }
  }
  if(!round){
    if(run.mode==="PACK"&&runTargetCount(run)!==null&&
      run.currentIndex>=runTargetCount(run)!){
      await db().playRun.updateMany({where:{id:run.id,status:"ACTIVE"},
        data:{status:"FINISHED",completedAt:new Date()}});
      return runSummary(await db().playRun.findUniqueOrThrow({where:{id:run.id}}));
    }
    fail(409,"no_more_questions","No further questions in this run");
  }
  const quiz=await db().quiz.findUnique({where:{id:round.quizId}});
  if(!quiz || quiz.publication!=="PUBLISHED" || quiz.safetyStatus!=="ACTIVE" ||
    (run.lane==="KIDS" && !(quiz.safetyStatus==="ACTIVE"&&quiz.kidsEligible&&quiz.kidsReviewStatus==="APPROVED"))){
    if(run.mode==="PACK"&&run.lane==="GENERAL")return skipWithdrawnPackRound(run,p,actor);
    fail(409,"question_suspended","This question is temporarily unavailable for safety review");
  }
  const revision=await db().quizRevision.findUnique({where:{id:round.revisionId},include:{localization:true}});
  if(!revision || revision.localization?.locale!==run.locale ||
    revision.localization.status!=="PUBLISHED" ||
    !Array.isArray(revision.clues)||(!revision.clues.length&&(revision.answer as {responseMode?:string})?.responseMode!=="multiple-choice")){
    if(run.mode==="PACK"&&run.lane==="GENERAL")return skipWithdrawnPackRound(run,p,actor);
    fail(409,"invalid_question","The pinned question version is unavailable");
  }
  if(!await pinnedMediaApproved([revision])){
    if(run.mode==="PACK"&&run.lane==="GENERAL")return skipWithdrawnPackRound(run,p,actor);
    fail(409,"question_suspended","This pinned question contains unapproved or restricted media");
  }
  const token=sessionToken(p.runToken,run.id,run.currentIndex);
  let session=await db().playSession.findUnique({where:{runId_roundIndex:{runId:run.id,roundIndex:run.currentIndex}}});
  if(!session) {
    try {
      session=await db().playSession.create({data:{
        quizId:round.quizId,revisionId:round.revisionId,locale:run.locale,userId:run.userId,
        runId:run.id,roundIndex:run.currentIndex,tokenHash:hash(token),
        usedClues:revision.clues.length===0?0:1,expiresAt:run.expiresAt
      }});
    }catch(error:any){
      if(error?.code!=="P2002") throw error;
      session=await db().playSession.findUnique({where:{runId_roundIndex:{runId:run.id,roundIndex:run.currentIndex}}});
    }
  }
  if(!session) fail(409,"run_conflict","Retry the current question");
  const clues=revision.clues as Array<Record<string,unknown>>;
  const [ratings,myRating]=await Promise.all([ratingsForQuiz(quiz.id,run.locale as Locale),myRatingForQuiz(quiz.id,actor,run.locale as Locale)]);
  return {...runSummary(run),sessionId:session.id,sessionToken:token,
    ratings,myRating,ratingAccess:ratingAccess(actor,quiz.authorId,session.userId),
    round:run.currentIndex+1,quizId:round.quizId,locale:run.locale,quizVersion:revision.version,
    title:revision.title,prompt:revision.prompt,promptMediaIds:revision.promptMediaIds,
    clueIndex:session.usedClues,clueCount:clues.length,
    clues:clues.slice(0,session.usedClues),sessionStatus:session.status,
    canGuess:session.status==="ACTIVE"&&(clues.length===0||session.wrongGuesses<session.usedClues),
    ...publicAnswerFormat(revision.answer, session.id),
    ...(session.status!=="ACTIVE"?{scoreThisQuestion:session.score,explanation:revision.explanation}:{}),
  };
}
export async function runFinish(p:Record<string,any>,actor:Actor|null) {
  const run=await checkedRun(p.runId,p.runToken,actor);
  if(run.mode!=="INFINITE") fail(403,"finish_not_allowed","Only continuous random runs can end early");
  if(run.status==="FINISHED") return runSummary(run);
  const updated=await db().playRun.update({where:{id:run.id},data:{status:"FINISHED",completedAt:new Date()}});
  return runSummary(updated);
}
/** Display finished questions only. Never expose answers or unplayed rounds. */
export async function runFeedback(p:Record<string,any>,actor:Actor|null) {
  const run=await checkedRun(p.runId,p.runToken,actor);
  if(run.status!=="FINISHED")fail(409,"run_in_progress","Finish the run before rating questions");
  const recentFirst=run.mode==="INFINITE";
  const sessions=await db().playSession.findMany({
    where:{runId:run.id,status:{in:["SOLVED","FAILED"]},quiz:{publication:"PUBLISHED",safetyStatus:"ACTIVE"}},
    select:{quizId:true,userId:true,roundIndex:true,revision:{select:{title:true,localization:{select:{origin:true}}}},
      quiz:{select:{authorId:true}}},
    orderBy:{roundIndex:recentFirst?"desc":"asc"},take:run.mode==="PACK"?100:5
  });
  if(recentFirst)sessions.reverse();
  const ids=sessions.map(s=>s.quizId);
  const [ratings,previous,translationRatings]=await Promise.all([
    ratingsForQuizzes(ids,run.locale as Locale),
    actor&&ids.length?db().review.findMany({
      where:{authorId:actor.id,quizId:{in:ids},locale:run.locale,kind:"QUIZ"},select:{quizId:true,rating:true}
    }):Promise.resolve([]),
    actor&&ids.length?db().review.findMany({where:{authorId:actor.id,quizId:{in:ids},locale:run.locale,kind:"TRANSLATION"},select:{quizId:true,rating:true}}):Promise.resolve([])
  ]);
  const saved=new Map(previous.map(r=>[r.quizId,r.rating]));
  const savedTranslation=new Map(translationRatings.map(r=>[r.quizId,r.rating]));
  return {runId:run.id,locale:run.locale,items:sessions.map(s=>({
    quizId:s.quizId,title:s.revision.title,round:(s.roundIndex??0)+1,
    ratings:ratings.get(s.quizId),myRating:saved.get(s.quizId)??null,
    isTranslation:s.revision.localization?.origin==="TRANSLATION",
    myTranslationRating:savedTranslation.get(s.quizId)??null,
    ratingAccess:ratingAccess(actor,s.quiz.authorId,s.userId)
  }))};
}

/** Only the owner (signed in) or a guest with their run capability may publish a result. */
async function shareableOwnedRun(p:Record<string,any>,actor:Actor|null) {
  if (actor?.childScope) fail(403,"share_forbidden","Child profiles cannot publish scores");
  // An owner can reopen a historical run without a token. A guest capability
  // remains valid if that player signs in between finishing and sharing.
  const owned=actor?await db().playRun.findFirst({where:{id:p.runId,userId:actor.id}}):null;
  const run=owned??(p.runToken
    ? await checkedRun(p.runId,p.runToken,actor)
    : fail(401,"authentication_required","Sign in or use the original run session"));
  if(!run)fail(404,"run_not_found","Play run was not found");
  if(run.mode!=="PACK"||run.lane!=="GENERAL"||!run.packId)
    fail(403,"share_forbidden","Only general quiz pack results can be shared");
  if(run.status!=="FINISHED"||!run.completedAt)
    fail(409,"run_in_progress","Finish the pack before sharing its result");
  return run;
}

/** Explicit opt-in: simply finishing a run never exposes its result publicly. */
export async function runShare(p:Record<string,any>,actor:Actor|null) {
  const run=await shareableOwnedRun(p,actor);
  await safePack(run.packId!,run.locale as Locale,"GENERAL");
  if(run.shareId)return {shareId:run.shareId};
  const shareId=randomUUID();
  const updated=await db().playRun.updateMany({
    where:{id:run.id,status:"FINISHED",shareId:null},
    data:{shareId,sharedAt:new Date()}
  });
  if(updated.count)return {shareId};
  const current=await db().playRun.findUnique({where:{id:run.id},select:{shareId:true}});
  if(!current?.shareId)fail(409,"share_conflict","Please try sharing again");
  return {shareId:current.shareId};
}

/** A new share after revocation always gets a new URL; old links stop working. */
export async function runUnshare(p:Record<string,any>,actor:Actor|null) {
  const run=await shareableOwnedRun(p,actor);
  await db().playRun.update({where:{id:run.id},data:{shareId:null,sharedAt:null}});
  return {unshared:true};
}

/** Minimal public, read-only result. Never include player identity, run tokens or answers. */
export async function runShareGet(p:Record<string,any>) {
  const run=await db().playRun.findUnique({where:{shareId:p.shareId},select:{
    shareId:true,mode:true,lane:true,locale:true,packId:true,
    status:true,completedAt:true,currentIndex:true,score:true,solved:true,failed:true,
    packVersion:true,scoringVersion:true,
    pack:{select:{kidsEligible:true}}
  }});
  if(!run||run.mode!=="PACK"||run.lane!=="GENERAL"||run.status!=="FINISHED"||
     !run.packId||!run.completedAt)fail(404,"result_not_found","Shared result was not found");
  let pack;
  try{pack=await safePack(run.packId,run.locale as Locale,"GENERAL");}
  catch{fail(404,"result_unavailable","This result is no longer public");}
  return {shareId:run.shareId,packId:run.packId,title:pack.title,locale:run.locale,
    packVersion:run.packVersion,currentPackVersion:pack.packVersion,
    // Legacy scores without a pinned pack version or comparable scoring rules are not comparable.
    comparable:run.packVersion!==null && run.packVersion===pack.packVersion && run.scoringVersion===2,
    score:run.score,completed:run.currentIndex,solved:run.solved,failed:run.failed,
    completedAt:run.completedAt,kidsEligible:run.pack?.kidsEligible??true};
}


/**
 * Restore stale run totals using completed PlaySession rows that already exist
 * on the server. Owner-only; NEVER invent missing answers or mark a partially
 * completed pack finished. Safe to call repeatedly from account history.
 */
export async function runReconcile(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  if(actor?.childScope)fail(403,"reconcile_forbidden","Child runs cannot be reconciled here");
  const runs=await db().playRun.findMany({
    where:{userId:user.id,lane:"GENERAL",mode:{in:["PACK","RANDOM_FIVE"]}},
    select:{id:true},orderBy:{startedAt:"desc"},skip:p.offset,take:p.limit
  });
  let repaired=0,scanned=0;
  for(const row of runs){
    for(let attempt=0;attempt<5;attempt++){
      try{
        const changed=await db().$transaction(async tx=>{
          const run=await tx.playRun.findFirst({where:{id:row.id,userId:user.id}});
          if(!run)return false;
          const questionCount=await tx.playRunQuestion.count({where:{runId:run.id}});
          if(!questionCount)return false;
          const sessions=await tx.playSession.findMany({
            where:{runId:run.id,status:{in:["SOLVED","FAILED"]}},
            select:{roundIndex:true,status:true,score:true}
          });
          const known=new Map(sessions.filter(s=>s.roundIndex!==null&&s.roundIndex>=0&&s.roundIndex<questionCount)
            .map(s=>[s.roundIndex!,s]));
          let contiguous=0;
          while(known.has(contiguous))contiguous++;
          const values=[...known.values()];
          // A previous safety withdrawal can legitimately skip an unanswered
          // pack slot. Repair is additive and must never undo that progress.
          const completed=Math.max(run.currentIndex,contiguous);
          const score=Math.max(run.score,values.reduce((sum,s)=>sum+s.score,0));
          const solved=Math.max(run.solved,values.filter(s=>s.status==="SOLVED").length);
          const failed=Math.max(run.failed,values.filter(s=>s.status==="FAILED").length);
          const isFinished=completed>=questionCount;
          const differs=run.currentIndex!==completed||run.score!==score||
            run.solved!==solved||run.failed!==failed||
            (isFinished&&run.status!=="FINISHED");
          if(!differs)return false;
          await tx.playRun.update({where:{id:run.id},data:{
            currentIndex:completed,score,solved,failed,
            ...(isFinished?{status:"FINISHED",completedAt:run.completedAt??new Date()}:{})
          }});
          return true;
        },{isolationLevel:"Serializable",maxWait:10000,timeout:20000});
        scanned++;
        if(changed)repaired++;
        break;
      }catch(error:unknown){
        const code=(error as {code?:string})?.code;
        if((code==="P2034"||code==="P2002")&&attempt<4)continue;
        throw error;
      }
    }
  }
  return {scanned,repaired};
}
export async function runHistory(p:Record<string,any>,actor:Actor|null) {
  const user=requireActor(actor);
  const now=new Date();
  // Completed runs and live, available pack runs are the only useful history.
  // Incomplete random runs and expired/withdrawn packs have no resume action.
  const where={
    userId:user.id,
    OR:[
      {status:"FINISHED" as const},
      {status:"ACTIVE" as const,mode:"PACK" as const,lane:"GENERAL" as const,
        expiresAt:{gt:now},pack:{is:{publication:"PUBLISHED" as const,
          safetyStatus:"ACTIVE" as const,localizations:{some:{status:"PUBLISHED" as const}}}}}
    ]
  };
  const [rows,count]=await Promise.all([
    db().playRun.findMany({where,orderBy:{startedAt:"desc"},skip:p.offset,take:p.limit,
      include:{pack:{select:{title:true,publication:true,safetyStatus:true,
        localizations:{select:{title:true,locale:true,status:true}}}}}}),
    db().playRun.count({where})
  ]);
  return {items:rows.map(run=>({...runSummary(run),startedAt:run.startedAt,
    canResume:run.mode==="PACK"&&run.status==="ACTIVE"&&run.expiresAt.getTime()>now.getTime()&&
      run.pack?.publication==="PUBLISHED"&&run.pack?.safetyStatus==="ACTIVE"&&
      run.pack.localizations.some(loc=>loc.locale===run.locale&&loc.status==="PUBLISHED"),
    shareId:run.shareId,packTitle:run.pack?.localizations.find(loc=>loc.locale===run.locale&&loc.status==="PUBLISHED")?.title??run.pack?.title??null})),
    total:count,offset:p.offset,limit:p.limit};
}
