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
// Distinguish 4 (thumb tucked) from 5 (thumb extended). The previous
// 1.32 / 1.52 index-base ratios rejected genuine splayed thumbs, because
// the thumb tip often advances only slightly farther than the IP joint.
export function isThumbExtended(points){
 if(!palmPoint(points)||![2,3,4].every(i=>points[i]))return false;
 const tip=points[4],ip=points[3],base=points[2],wrist=points[0],index=points[5];
 const palmWidth=Math.max(.001,distance(points[5],points[17]));
 const awayFromIndex=distance(tip,index)-distance(ip,index);
 const awayFromWrist=distance(tip,wrist)-distance(ip,wrist);
 const reach=distance(tip,base);
 const linkLength=distance(base,ip)+distance(ip,tip);
 // Independent camera rotation / hand-size invariant evidence of splay.
 // Both a wider thumb-index gap and extended thumb geometry are required,
 // preventing a curled thumb from randomly converting answer 4 into 5.
 return awayFromIndex>palmWidth*.045 &&
  (awayFromWrist>palmWidth*.06 ||
   (linkLength>0&&reach/linkLength>.88));
}
export function fingerCount(points){
 const raised=raisedLongFingers(points);
 if(raised===null)return null;
 return raised+(isThumbExtended(points)?1:0);
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
