// Camera coordinates are normalized; landmarks never leave the browser.
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function palmPoint(points){
 if(!Array.isArray(points)||points.length<21)return null;
 const ids=[0,5,9,13,17];
 if(ids.some(i=>!Number.isFinite(points[i]?.x)||!Number.isFinite(points[i]?.y)))return null;
 return {x:ids.reduce((s,i)=>s+points[i].x,0)/5,y:ids.reduce((s,i)=>s+points[i].y,0)/5};
}
// Four long fingers determine an open palm independently of the thumb.
// This also works while the thumb tip is partially occluded by the camera.
export function raisedLongFingers(points){
 if(!palmPoint(points))return null;
 const wrist=points[0];
 let raised=0;
 for(const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]]){
  if(!points[tip]||!points[pip])return null;
  if(distance(points[tip],wrist)>distance(points[pip],wrist)*1.16)raised++;
 }
 return raised;
}
// Only index through pinky can select answers 1–4. A thumb that is
// accidentally classified as extended must NEVER turn a fist into "1" or
// an index-only pose into "2". We inspect the thumb solely to distinguish
// four raised long fingers (answer 4) from an open five-finger palm (ready).
//
// Thumb extension needs separation toward the thumb SIDE of the palm.
// A folded thumb lying across the knuckles can be straight and farther from
// the wrist/index, so distance or straightness alone is not reliable.
export function isThumbExtended(points){
 if(!palmPoint(points)||![3,4,5,17].every(i=>points[i]))return false;
 const index=points[5],pinky=points[17],ip=points[3],tip=points[4];
 const axis={x:index.x-pinky.x,y:index.y-pinky.y};
 const width=Math.hypot(axis.x,axis.y);
 if(width<.001)return false;
 const along=(p)=>((p.x-index.x)*axis.x+(p.y-index.y)*axis.y)/(width*width);
 const tipOutside=along(tip);
 const thumbExtension=tipOutside-along(ip);
 // With the camera rotated or mirrored, the knuckle axis rotates/mirrors
 // with the hand. Both tests remain invariant to scale and orientation.
 return tipOutside>.23 && thumbExtension>.10;
}
export function fingerCount(points){
 const raised=raisedLongFingers(points);
 if(raised===null)return null;
 return raised===4&&isThumbExtended(points)?5:raised;
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
 return {
  x:clamp01((mirrored.x-.10)/.80),
  y:clamp01((mirrored.y-.08)/.80),
  // Preserve the original camera coordinate for the game's compact control
  // surface. Reaching a choice should NEVER require dropping the whole hand
  // below the camera's field of view.
  cameraX:mirrored.x,cameraY:mirrored.y
 };
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
