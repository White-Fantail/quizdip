// All coordinates are normalized camera coordinates. No images or biometrics leave the device.
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function palmPoint(points){
 if(!Array.isArray(points)||points.length<21)return null;
 const ids=[0,5,9,13,17];
 if(ids.some(i=>!Number.isFinite(points[i]?.x)||!Number.isFinite(points[i]?.y)))return null;
 return {x:ids.reduce((s,i)=>s+points[i].x,0)/5,y:ids.reduce((s,i)=>s+points[i].y,0)/5};
}
export function handGesture(points){
 if(!Array.isArray(points)||points.length<21)return "unknown";
 const palm=palmPoint(points);if(!palm)return "unknown";
 // Four long fingers: compare wrist distances between tip and PIP, ignoring thumb.
 const pairs=[[8,6],[12,10],[16,14],[20,18]];
 let extended=0;
 for(const [tip,pip] of pairs){
  if(!points[tip]||!points[pip])return "unknown";
  if(distance(points[tip],points[0])>distance(points[pip],points[0])*1.18)extended++;
 }
 if(extended>=4)return "open";
 if(extended<=1)return "fist";
 return "neutral";
}
export function screenPoint(palm,mirror=true){
 return {x:Math.max(0,Math.min(1,mirror?1-palm.x:palm.x)),y:Math.max(0,Math.min(1,palm.y))};
}
export function nearestTrackMatching(existing,detections,maxDistance=.21){
 // Greedy assignment over globally sorted distances, each track and detection used once.
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
