/**
 * Progressive, per-player answer selection. Only a continuously observed hand
 * displaying its assigned number can accumulate time. A short hover arms the
 * countdown; only after the full countdown is a vote returned.
 */
export const SELECT_ARM_MS=650;
export const SELECT_COUNTDOWN_MS=1800;
export const OBSERVATION_GAP_MS=320;
export function dwellSelection(previous,hand,choice,now){
 const valid=hand&&Number.isInteger(hand.id)&&hand.id>=1&&hand.id<=5&&
   hand.count===hand.id&&hand.gesture==="open"&&Number.isInteger(choice)&&choice>=0&&choice<=3;
 if(!valid)return {state:null,chosen:null};
 let s=previous;
 if(!s||s.choice!==choice||now<s.lastAt||now-s.lastAt>OBSERVATION_GAP_MS){
  s={choice,enteredAt:now,lastAt:now,phase:"arming",progress:0,remainingMs:SELECT_COUNTDOWN_MS};
 }else{
  s={...s,lastAt:now};
 }
 const elapsed=now-s.enteredAt;
 if(elapsed<SELECT_ARM_MS)return {state:{...s,phase:"arming",progress:0,remainingMs:SELECT_COUNTDOWN_MS},chosen:null};
 const counting=elapsed-SELECT_ARM_MS;
 if(counting>=SELECT_COUNTDOWN_MS)return {state:null,chosen:choice};
 return {state:{...s,phase:"countdown",
   progress:Math.min(1,counting/SELECT_COUNTDOWN_MS),
   remainingMs:SELECT_COUNTDOWN_MS-counting},chosen:null};
}
