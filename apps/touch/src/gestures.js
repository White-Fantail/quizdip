// Camera coordinates are normalized; landmarks never leave the browser.
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function palmPoint(points){
 if(!Array.isArray(points)||points.length<21)return null;
 const ids=[0,5,9,13,17];
 if(ids.some(i=>!Number.isFinite(points[i]?.x)||!Number.isFinite(points[i]?.y)))return null;
 return {x:ids.reduce((s,i)=>s+points[i].x,0)/5,y:ids.reduce((s,i)=>s+points[i].y,0)/5};
}
// Count explicitly extended fingers. 1–4 use index→pinky with thumb folded;
// 5 additionally extends thumb. This is a pose cue, not biometric identity.
export function fingerCount(points){
 if(!palmPoint(points))return null;
 const wrist=points[0];
 const fingers=[[8,6],[12,10],[16,14],[20,18]];
 let count=0;
 for(const [tip,pip] of fingers){
  if(!points[tip]||!points[pip])return null;
  if(distance(points[tip],wrist)>distance(points[pip],wrist)*1.16)count++;
 }
 // Thumb is identified by distance from the index-finger base. This
 // orientation-independent check is more reliable than x ordering.
 const thumbOpen=distance(points[4],points[5])>distance(points[3],points[5])*1.32 &&
   distance(points[4],points[5])>distance(points[2],points[5])*1.52;
 return count+(thumbOpen?1:0);
}
export function handGesture(points){
 const n=fingerCount(points);
 return n===null?"unknown":n===0?"fist":n>=1?"open":"neutral";
}
export function screenPoint(palm,mirror=true){
 return {x:Math.max(0,Math.min(1,mirror?1-palm.x:palm.x)),y:Math.max(0,Math.min(1,palm.y))};
}
// The control cursor follows the visibly extended fingertips rather than the palm.
// This is separate from palm-based physical-track matching (which must remain stable).
// Camera space is mirrored to match the local preview. The active camera region is
// expanded to the whole screen, so top-row answers need less physical reach.
export function screenControlPoint(points){
 const palm=palmPoint(points);
 if(!palm)return null;
 const wrist=points[0],tips=[];
 for(const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]]){
  if(distance(points[tip],wrist)>distance(points[pip],wrist)*1.16)tips.push(points[tip]);
 }
 const source=tips.length?{
  x:tips.reduce((sum,p)=>sum+p.x,0)/tips.length,
  y:tips.reduce((sum,p)=>sum+p.y,0)/tips.length
 }:palm;
 const mirrored=screenPoint(source);
 const clamp01=n=>Math.max(0,Math.min(1,n));
 return {x:clamp01((mirrored.x-.10)/.80),y:clamp01((mirrored.y-.08)/.80)};
}
export function nearestTrackMatching(existing,detections,maxDistance=.21){
 const candidates=[];
 existing.forEach((t,ti)=>detections.forEach((d,di)=>{
  const value=distance(t,d);if(value<=maxDistance)candidates.push({ti,di,value});
 }));
 candidates.sort((a,b)=>a.value-b.value);
 const assigned=new Map(),usedTrack=new Set(),usedDetection=new Set();
 for(const c of candidates){
  if(usedTrack.has(c.ti)||usedDetection.has(c.di))continue;
  usedTrack.add(c.ti);usedDetection.add(c.di);assigned.set(c.di,c.ti);
 }
 return assigned;
}
export function answerAtPosition(x,y,rects){
 const found=rects.findIndex(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);
 return found<0?null:found;
}
