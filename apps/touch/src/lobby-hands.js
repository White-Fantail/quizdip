// A visible, hands-only two-step lobby. Holding open palms in their current
// camera lanes first freezes the seat count, then starts the round.
// Four straight long fingers are sufficient: the thumb isn't an enrollment
// requirement, and a folded thumb/fist never fires the lobby countdown.
export const LOCK_HOLD_MS=2700;
export const LAUNCH_HOLD_MS=1500;
const GAP_MS=460;
export function updateLobbyHold(previous,phase,hands,expectedCount,now,enabled=true){
 const requiredMs=phase==="scanning"?LOCK_HOLD_MS:LAUNCH_HOLD_MS;
 const accepted=enabled&&expectedCount>=1&&expectedCount<=5&&
  hands.length===expectedCount&&hands.every(h=>h.spread===true);
 if(!accepted)return {since:null,lastAt:now,signature:null,progress:0,action:null};
 const signature=hands.map(h=>phase==="scanning"?h.rawId:h.id).join(",");
 const continuing=previous?.signature===signature &&
  previous?.lastAt<=now&&now-previous.lastAt<=GAP_MS;
 const since=continuing?previous.since:now;
 const progress=Math.min(1,Math.max(0,(now-since)/requiredMs));
 return {since,lastAt:now,signature,progress,
  action:progress>=1?(phase==="scanning"?"lock":"start"):null};
}
