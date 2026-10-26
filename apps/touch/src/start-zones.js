/**
 * Each player has an independent start pad; players never need to move into
 * one shared region and overlap. Readiness is NOT latched: all must remain in
 * their own pads with their same count until the simultaneous hold completes.
 */
export const START_HOLD_MS=1350;
export const START_GAP_MS=320;
export function updateStartPads(previous,playerIds,hands,inPad,now){
 const old=previous||new Map();
 const next=new Map();
 let insideCount=0,readyCount=0;
 const active=new Map(hands.map(h=>[h.id,h]));
 for(const id of playerIds){
  const hand=active.get(id);
  const valid=hand&&hand.count===id&&hand.gesture==="open"&&inPad(id,hand);
  if(!valid)continue;
  insideCount++;
  const prior=old.get(id);
  const since=prior&&now>=prior.lastAt&&now-prior.lastAt<=START_GAP_MS?prior.since:now;
  const elapsed=now-since;
  const progress=Math.min(1,elapsed/START_HOLD_MS);
  next.set(id,{since,lastAt:now,progress,ready:elapsed>=START_HOLD_MS});
  if(elapsed>=START_HOLD_MS)readyCount++;
 }
 return {holds:next,insideCount,readyCount,total:playerIds.length,
  start:playerIds.length>0&&readyCount===playerIds.length};
}
