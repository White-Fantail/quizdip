/**
 * A pack can retain unsynced local progress until expiresAt. Never convert a
 * valid run into an irreversible abandoned state just because the server has
 * not yet received an answer. The admin view can label it idle safely.
 */
export const RUN_IDLE_MS=30*60*1000;
export type EffectiveRunStatus="ACTIVE"|"NOT_STARTED"|"IDLE"|"EXPIRED"|"FINISHED";
export const ATTEMPTED_SESSION_FILTER={
  OR:[{status:{in:["SOLVED","FAILED"]}},{wrongGuesses:{gt:0}}]
};
export const ANSWERED_RUN_FILTER={
  OR:[{solved:{gt:0}},{failed:{gt:0}},{sessions:{some:ATTEMPTED_SESSION_FILTER}}]
};
export const UNANSWERED_RUN_FILTER={
  solved:0,failed:0,sessions:{none:ATTEMPTED_SESSION_FILTER}
};
export function effectiveRunStatus(run:{
  status:string;startedAt:Date;expiresAt:Date;solved:number;failed:number;
},hasAttemptedSession:boolean,now=new Date()):EffectiveRunStatus{
  if(run.status==="FINISHED")return "FINISHED";
  if(run.status==="EXPIRED"||run.expiresAt.getTime()<=now.getTime())return "EXPIRED";
  if(run.solved>0||run.failed>0||hasAttemptedSession)return "ACTIVE";
  return run.startedAt.getTime()<=now.getTime()-RUN_IDLE_MS?"IDLE":"NOT_STARTED";
}
