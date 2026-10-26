import {dwellSelection} from "./selection.js";

// A single stable, numbered hand may replay, even if it was never a player.
// The first hover is not a click: it must complete the same dwell countdown
// used for choices. Losing sight of the hand or changing finger count cancels it.
export function replayDwell(previous,candidates,rect,now){
 const inside=rect?candidates.filter(h=>h.count===h.id&&h.id>=1&&h.id<=5&&
  h.x>=rect.left&&h.x<=rect.right&&h.y>=rect.top&&h.y<=rect.bottom):[];
 const active=inside.find(h=>h.id===previous?.id)||inside[0];
 const decision=dwellSelection(active?.id===previous?.id?previous:null,
  active?{...active,gesture:"open"}:null,active?0:null,now);
 return {state:decision.state&&active?{...decision.state,id:active.id}:null,
  restart:decision.chosen!==null};
}
