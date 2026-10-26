import {palmPoint,handGesture,screenPoint,nearestTrackMatching} from "./gestures.js";
export const MAX_PLAYERS=8;
const LOST_MS=1100;
export class HandTracker {
 constructor(){this.tracks=[];this.nextId=1;}
 update(landmarks,now){
  const detections=(landmarks||[]).map(points=>({points,palm:palmPoint(points)})).filter(d=>d.palm);
  const current=this.tracks.filter(t=>now-t.seen<LOST_MS);
  const mapping=nearestTrackMatching(current.map(t=>t.palm),detections.map(d=>d.palm));
  const output=[];
  detections.slice(0,MAX_PLAYERS).forEach((d,i)=>{
   let t=mapping.has(i)?current[mapping.get(i)]:null;
   if(!t){t={id:this.nextId++,palm:d.palm,seen:now,gesture:"unknown",since:now};this.tracks.push(t);}
   const newGesture=handGesture(d.points);
   if(newGesture!==t.gesture){t.gesture=newGesture;t.since=now;}
   t.palm={x:t.palm.x*.35+d.palm.x*.65,y:t.palm.y*.35+d.palm.y*.65};
   t.seen=now;
   output.push({id:t.id,x:screenPoint(t.palm).x,y:screenPoint(t.palm).y,gesture:t.gesture,gestureSince:t.since,seen:now});
  });
  this.tracks=this.tracks.filter(t=>now-t.seen<LOST_MS);
  return output;
 }
 reset(){this.tracks=[];this.nextId=1;}
}
