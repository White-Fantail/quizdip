// TOUCH horizontal-only controls.
//
// MediaPipe needs the hand and wrist to identify finger numbers. A vertical
// fingertip-to-screen mapping makes bottom answers unreachable with a raised
// hand. Instead, all four choices form one stationary horizontal row, and a
// small, *relative* left/right movement of the PALM selects one of four lanes.
// Calibrate once per player for the whole 10-question run; do not reset when a
// new question has longer text, an image, or different answer labels.
export const CALIBRATION_MS = 420;
export const CONTROL_HALF_SPAN = 0.18;
export const NEUTRAL_DEAD_ZONE = 0.018;
export const MAX_OBSERVATION_GAP_MS = 500;

const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));

export function horizontalControl(previous,hand,now){
 if(!hand||hand.count!==hand.id||!Number.isInteger(hand.id)||
    !Number.isFinite(hand.palmX)||!Number.isFinite(now))
  return {state:previous??null,ready:false,position:null,choice:null};
 let s=previous??{id:hand.id,anchor:hand.palmX,startedAt:now,lastAt:now,ready:false,samples:1};
 if(s.id!==hand.id)s={id:hand.id,anchor:hand.palmX,startedAt:now,lastAt:now,ready:false,samples:1};
 if(!s.ready){
  // Only acquire the neutral position while the hand is steadily visible.
  if(now<s.lastAt||now-s.lastAt>MAX_OBSERVATION_GAP_MS){
   s={id:hand.id,anchor:hand.palmX,startedAt:now,lastAt:now,ready:false,samples:1};
  }else{
   const samples=Math.min(s.samples+1,40);
   s={...s,anchor:s.anchor+(hand.palmX-s.anchor)/samples,samples,lastAt:now};
  }
  if(now-s.startedAt>=CALIBRATION_MS)s={...s,ready:true};
 }
 if(!s.ready)return {state:s,ready:false,position:null,choice:null};
 // A fixed neutral position is invariant across questions, view dimensions,
 // language changes and answers with or without media.
 const delta=hand.palmX-s.anchor;
 // P1/P5 may have joined from pads near the camera's left/right edge.
 // Compress movement on that side instead of requiring the palm to move
 // outside the frame to reach A or D.
 const availableLeft=Math.max(.045,Math.min(CONTROL_HALF_SPAN,s.anchor-.025));
 const availableRight=Math.max(.045,Math.min(CONTROL_HALF_SPAN,.975-s.anchor));
 const available=delta<0?availableLeft:availableRight;
 const position=clamp(.5+delta/(available*2),.02,.98);
 let choice=null;
 const deadZone=Math.min(NEUTRAL_DEAD_ZONE,available*.12);
 if(Math.abs(delta)>deadZone){
  choice=Math.min(3,Math.floor(position*4));
 }
 return {state:{...s,lastAt:now},ready:true,position,choice};
}
