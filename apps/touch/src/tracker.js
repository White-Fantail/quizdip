import {palmPoint,handGesture,screenPoint,distance} from "./gestures.js";
export const MAX_PLAYERS=8;

// The camera detects hands, not people. A registered hand's ID must survive a
// short occlusion or a fist/palm transition. Do NOT delete registered slots.
const ACTIVE_WINDOW_MS=950;
const UNREGISTERED_EXPIRE_MS=2200;
const MAX_REJOIN_MS=25000;
const MAX_REJOIN_DISTANCE=.43;
const MAX_SMOOTHING_GAP_MS=420;

function handSize(points) {
 const wrist=points[0],middle=points[9];
 return wrist&&middle?Math.max(.01,distance(wrist,middle)):0;
}
function predicted(t,now) {
 const elapsed=Math.max(0,Math.min(260,now-t.seen))/1000;
 return {x:t.palm.x+t.velocity.x*elapsed,y:t.palm.y+t.velocity.y*elapsed};
}
function assignmentScore(t,d,now) {
 const age=now-t.seen;
 const isRecent=age<=ACTIVE_WINDOW_MS;
 if(!isRecent&&age>MAX_REJOIN_MS)return Infinity;
 const reference=isRecent?predicted(t,now):t.palm;
 const delta=distance(reference,d.palm);
 const maxDistance=isRecent?Math.min(.31,.12+.00125*Math.max(0,age)):MAX_REJOIN_DISTANCE;
 if(delta>maxDistance)return Infinity;
 // Appearance assists but cannot identify people. Position is authoritative.
 const sizeDiff=Math.abs(Math.log(Math.max(.01,d.size)/Math.max(.01,t.size)));
 if(sizeDiff>1.25)return Infinity; // Very different scale; likely a different hand
 const sidePenalty=t.side&&d.side&&t.side!==d.side ? .075 : 0;
 const distancePenalty=delta+Math.min(sizeDiff,.7)*.032+sidePenalty;
 // Prefer recently visible hands over a long-lost registered slot.
 const stalePenalty=isRecent?0:.035+Math.min(.08,age/160000);
 return distancePenalty+stalePenalty;
}
export class HandTracker {
 constructor(){this.tracks=[];this.nextId=1;this.pinnedIds=new Set();}
 pin(id){this.pinnedIds.add(id);}
 setPinnedIds(ids){this.pinnedIds=new Set(ids);}
 find(id){return this.tracks.find(t=>t.id===id)||null;}
 update(landmarks,now,handednesses=[]){
  const detections=(landmarks||[]).map((points,i)=>({
   points,palm:palmPoint(points),size:handSize(points),
   side:handednesses?.[i]?.[0]?.categoryName||null
  })).filter(d=>d.palm&&d.size>0).slice(0,MAX_PLAYERS);
  const tracks=this.tracks.filter(t=>this.pinnedIds.has(t.id)||now-t.seen<=UNREGISTERED_EXPIRE_MS);
  const candidates=[];
  tracks.forEach((t,ti)=>detections.forEach((d,di)=>{
   const score=assignmentScore(t,d,now);
   if(Number.isFinite(score))candidates.push({ti,di,score});
  }));
  candidates.sort((a,b)=>a.score-b.score);
  const matched=new Map(),usedTracks=new Set(),usedDetections=new Set();
  const ambiguousDetections=new Set();
  for(const c of candidates){
   if(usedTracks.has(c.ti)||usedDetections.has(c.di))continue;
   // If two long-lost players are equally plausible, never silently swap them.
   const age=now-tracks[c.ti].seen;
   if(age>ACTIVE_WINDOW_MS){
    const alternative=candidates.some(other=>other.di===c.di&&other.ti!==c.ti&&!usedTracks.has(other.ti)&&
      now-tracks[other.ti].seen>ACTIVE_WINDOW_MS&&Math.abs(other.score-c.score)<.055);
    if(alternative){ambiguousDetections.add(c.di);continue;}
   }
   matched.set(c.di,tracks[c.ti]);
   usedTracks.add(c.ti);usedDetections.add(c.di);
  }
  const output=[];
  detections.forEach((d,i)=>{
   if(ambiguousDetections.has(i) && !matched.has(i))return;
   let t=matched.get(i);
   if(!t){
    // If a single registered hand was lost, its new detection can be moved
    // away from the old location. Only recover when no unassigned competing
    // hands or other missing registered players make the match ambiguous.
    const missing=tracks.filter(track=>this.pinnedIds.has(track.id)&&!usedTracks.has(tracks.indexOf(track)));
    const unmatchedCount=detections.length-matched.size;
    if(missing.length===1&&unmatchedCount===1&&now-missing[0].seen<MAX_REJOIN_MS&&
       (this.pinnedIds.size===1 || distance(missing[0].palm,d.palm)<.65)&&
       Math.abs(Math.log(Math.max(.01,d.size)/Math.max(.01,missing[0].size)))<.8){
      t=missing[0];
      usedTracks.add(tracks.indexOf(t));
    }
   }
   if(!t){
    t={id:this.nextId++,palm:d.palm,size:d.size,velocity:{x:0,y:0},
      seen:now,gesture:"unknown",since:now,pending:"unknown",pendingSince:now,side:d.side};
    this.tracks.push(t);
   }else{
    const gap=Math.max(1,now-t.seen);
    const old=t.palm;
    const alpha=gap>MAX_SMOOTHING_GAP_MS?1:.58;
    const newPalm={x:old.x*(1-alpha)+d.palm.x*alpha,y:old.y*(1-alpha)+d.palm.y*alpha};
    const instant={x:(newPalm.x-old.x)/(gap/1000),y:(newPalm.y-old.y)/(gap/1000)};
    // Ignore velocity across occlusion to avoid huge jumps in prediction.
    t.velocity=gap>MAX_SMOOTHING_GAP_MS?{x:0,y:0}:{
      x:Math.max(-2,Math.min(2,t.velocity.x*.6+instant.x*.4)),
      y:Math.max(-2,Math.min(2,t.velocity.y*.6+instant.y*.4))
    };
    t.palm=newPalm;t.size=t.size*.7+d.size*.3;
    if(d.side)t.side=d.side;
    if(gap>MAX_SMOOTHING_GAP_MS){t.gesture="unknown";t.pending="unknown";t.since=now;}
   }
   const gesture=handGesture(d.points);
   if(gesture!==t.pending){t.pending=gesture;t.pendingSince=now;}
   if(gesture==="open"&&t.gesture!=="open"&&now-t.pendingSince>=110){t.gesture="open";t.since=now;}
   if(gesture==="fist"&&t.gesture!=="fist"&&now-t.pendingSince>=110){t.gesture="fist";t.since=now;}
   if(gesture==="neutral"||gesture==="unknown"){
    // Short uncertain landmark readings while closing a fist are common.
    // Do not keep a stale gesture indefinitely.
    if(now-t.pendingSince>230&&t.gesture!=="neutral"){t.gesture="neutral";t.since=now;}
   }
   t.seen=now;
   const point=screenPoint(t.palm);
   output.push({id:t.id,x:point.x,y:point.y,gesture:t.gesture,
     gestureSince:t.since,seen:now});
  });
  this.tracks=this.tracks.filter(t=>this.pinnedIds.has(t.id)||now-t.seen<=UNREGISTERED_EXPIRE_MS);
  return output;
 }
 reset(){this.tracks=[];this.nextId=1;this.pinnedIds.clear();}
}
