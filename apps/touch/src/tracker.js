import {fingerCount,palmPoint,screenPoint,screenControlPoint,distance,nearestTrackMatching} from "./gestures.js";
export const MAX_PLAYERS=5;
const LOST_TRACK_MS=260;          // After overlap we demand a fresh finger-count proof.
const PROOF_HOLD_MS=340;          // Stable number is stronger than spatial identity.
const FIST_HOLD_MS=140;
const NOISE_GRACE_MS=680;
const FIST_ID_GRACE_MS=1700;
const NEAR_HAND_DISTANCE=.095;

export class HandTracker {
 constructor(){this.tracks=[];this.current=[];this.nextId=1;this.registered=new Set();}
 setRegistered(ids){this.registered=new Set(ids);}
 reset(){this.tracks=[];this.current=[];this.nextId=1;this.registered.clear();}
 update(landmarks,now){
  const detections=(landmarks||[]).map(points=>({points,palm:palmPoint(points),count:fingerCount(points)}))
    .filter(d=>d.palm!==null&&d.count!==null).slice(0,MAX_PLAYERS);
  const candidates=this.tracks.filter(t=>now-t.seen<=LOST_TRACK_MS);
  const matched=nearestTrackMatching(candidates.map(t=>t.palm),detections.map(d=>d.palm),.18);
  const next=[];
  const used=new Set();
  detections.forEach((d,i)=>{
   const candidateIndex=matched.get(i);
   let track=candidateIndex===undefined?null:candidates[candidateIndex];
   if(track)used.add(track.rawId);
   if(!track)track={rawId:this.nextId++,palm:d.palm,count:d.count,countSince:now,
     bound:null,lastProofAt:-Infinity,gesture:"unknown",gestureSince:now,fistSince:null,seen:now,blocked:false};
   const gap=now-track.seen;
   // Physical hands touching/crossing cannot safely inherit an earlier ID.
   const nearby=detections.some((other,j)=>j!==i&&distance(d.palm,other.palm)<NEAR_HAND_DISTANCE);
   const previousNearby=candidates.some(other=>other.rawId!==track.rawId&&
     distance(other.palm,track.palm)<NEAR_HAND_DISTANCE);
   const ambiguous=nearby||previousNearby;
   if(ambiguous){track.bound=null;track.lastProofAt=-Infinity;track.blocked=true;}
   if(d.count!==track.count){track.count=d.count;track.countSince=now;}
   track.palm=d.palm;track.points=d.points;track.seen=now;
   const countStable=now-track.countSince>=PROOF_HOLD_MS;
   // A held number owns a slot, regardless of where the hand reappeared.
   const unique=d.count>0&&!detections.some((other,j)=>j!==i&&other.count===d.count);
   if(!ambiguous&&unique&&countStable){
    // A folded 5-finger pose passes through 4, 3, 2 and 1.
    // Never transfer the slot on that transient intermediate count.
    // A true number change requires an extended, stable hold long enough
    // for deliberate recovery after hands have crossed.
    const switching=track.bound!==null&&track.bound!==d.count;
    if(!switching||now-track.countSince>=850){
     if(track.bound!==d.count){track.bound=d.count;track.fistSince=null;}
     track.lastProofAt=now;track.blocked=false;
    }
   }
   if(track.bound!==null&&d.count!==0&&d.count!==track.bound&&now-track.lastProofAt>NOISE_GRACE_MS){
    track.bound=null;track.blocked=true;
   }
   // Closing fingers is temporary: allow a recently verified physical track
   // to remain Pn until the fist is released. A new fist NEVER establishes ID.
   if(track.bound!==null&&d.count===0&&now-track.lastProofAt>FIST_ID_GRACE_MS){
    track.bound=null;track.blocked=true;
   }
   if(d.count===0){
    if(track.fistSince===null)track.fistSince=now;
    if(now-track.fistSince>=FIST_HOLD_MS){
     if(track.gesture!=="fist"){track.gesture="fist";track.gestureSince=now;}
    }
   }else{
    track.fistSince=null;
    if(track.gesture!=="open"){track.gesture="open";track.gestureSince=now;}
   }
   // A fresh track must display its own number before it can interact.
   // Guard against multiple hands claiming the same number.
   next.push(track);
  });
  // Preserve tracks for <=260ms if MediaPipe misses a frame while a fist forms.
  // Old tracks are never emitted as visible: a long loss requires re-enrollment.
  this.tracks=[...next,...candidates.filter(t=>!used.has(t.rawId)&&now-t.seen<=LOST_TRACK_MS)];
  this.current=next;
  const claims=new Map();
  for(const track of next){
   if(track.bound===null||!this.registered.has(track.bound))continue;
   claims.set(track.bound,(claims.get(track.bound)||0)+1);
  }
  return next.filter(track=>track.bound!==null&&this.registered.has(track.bound)&&
    !track.blocked&&claims.get(track.bound)===1)
    .map(track=>({...screenControlPoint(track.points),palmX:screenPoint(track.palm).x,id:track.bound,count:track.count,
      gesture:track.gesture,gestureSince:track.gestureSince,seen:now}));
 }
 // Unregistered stable poses are used only for enrollment; never for answering.
 candidates(now,holdMs=PROOF_HOLD_MS){
  return this.current.filter(track=>track.count>=1&&track.count<=MAX_PLAYERS&&
    now-track.countSince>=holdMs&&
    !track.blocked&&this.current.filter(other=>other.count===track.count).length===1)
   .map(track=>({...screenControlPoint(track.points),palmY:screenPoint(track.palm).y,id:track.count,count:track.count}));
 }
}
