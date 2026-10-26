// No dwell-only answer submission. Explicit open-number -> fist transition required.
// The choice is latched BEFORE folding, so the palm may drift slightly while
// fingers close without selecting a neighboring choice.
export function foldSelection(state,hand,choice,now,{armMs=130,fistMs=150}={}){
 const next=state??{choice:null,armSince:null,armed:false,fistSince:null};
 if(!hand||choice===null||hand.id===undefined){
  return {state:{choice:null,armSince:null,armed:false,fistSince:null},chosen:null};
 }
 const ownNumber=hand.count===hand.id && hand.gesture==="open";
 if(ownNumber){
  if(next.choice!==choice){next.choice=choice;next.armSince=now;next.armed=false;}
  if(next.armSince===null)next.armSince=now;
  if(now-next.armSince>=armMs)next.armed=true;
  next.fistSince=null;
  return {state:next,chosen:null};
 }
 if(hand.gesture==="fist"&&hand.count===0&&next.armed&&next.choice===choice){
  if(next.fistSince===null)next.fistSince=now;
  if(now-next.fistSince>=fistMs){
   return {state:{choice:null,armSince:null,armed:false,fistSince:null},chosen:choice};
  }
  return {state:next,chosen:null};
 }
 // Intermediate folding is allowed briefly only within the same answer card.
 if(next.choice!==choice)return {state:{choice:null,armSince:null,armed:false,fistSince:null},chosen:null};
 next.fistSince=null;
 if(next.armSince!==null&&now-next.armSince>1800)return {state:{choice:null,armSince:null,armed:false,fistSince:null},chosen:null};
 return {state:next,chosen:null};
}
