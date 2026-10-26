// One finger selects A, two B, three C, four D.
// Five fingers are a deliberate neutral pose between questions.
export const NEUTRAL_HOLD_MS=260;
export const SELECT_ARM_MS=360;
export const SELECT_COUNTDOWN_MS=1000;
export const MISSING_GRACE_MS=350;

const neutral=()=>({phase:"neutral",neutralSince:null,choice:null,lastAt:null});
export function fingerVote(previous,hand,now){
 let s=previous??neutral();
 if(!hand||!Number.isInteger(hand.count)){
  if(s.lastAt!==null&&now-s.lastAt<=MISSING_GRACE_MS)
   return {state:{...s,missingSince:s.missingSince??now},chosen:null};
  return {state:neutral(),chosen:null};
 }
 if(s.lastAt!==null&&(now<s.lastAt||now-s.lastAt>MISSING_GRACE_MS))s=neutral();
 if(s.missingSince!==undefined){
  const duration=now-s.missingSince;
  s={...s,neutralSince:s.neutralSince===null?null:s.neutralSince+duration,
   choiceSince:s.choiceSince===undefined?undefined:s.choiceSince+duration};
  delete s.missingSince;
 }
 const count=hand.count;
 if(count===5){
  const since=s.neutralSince===null?now:s.neutralSince;
  const phase=now-since>=NEUTRAL_HOLD_MS?"ready":"neutral";
  return {state:{phase,neutralSince:since,choice:null,lastAt:now},chosen:null};
 }
 if(count===0||count<1||count>4)
  return {state:{...neutral(),lastAt:now},chosen:null};
 if(s.phase==="neutral")
  return {state:{...neutral(),lastAt:now},chosen:null}; // Show five first.
 if(s.choice!==count-1){
  return {state:{phase:"arming",choice:count-1,choiceSince:now,
   neutralSince:null,lastAt:now,progress:0,remainingMs:SELECT_COUNTDOWN_MS},chosen:null};
 }
 const elapsed=now-s.choiceSince;
 if(elapsed<SELECT_ARM_MS)
  return {state:{...s,phase:"arming",lastAt:now,progress:0,remainingMs:SELECT_COUNTDOWN_MS},chosen:null};
 const remaining=SELECT_COUNTDOWN_MS-(elapsed-SELECT_ARM_MS);
 if(remaining<=0)return {state:null,chosen:s.choice};
 return {state:{...s,phase:"countdown",lastAt:now,
  progress:1-remaining/SELECT_COUNTDOWN_MS,remainingMs:remaining},chosen:null};
}
