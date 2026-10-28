import {palmPoint,screenPoint,fingerCount,fingerStates,nearestTrackMatching} from "./gestures.js";

// Player identity belongs to a physical camera lane, NEVER to the finger pose.
export const MAX_ZONE_PLAYERS=5;
export const ENROLL_HOLD_MS=800;
export const REACQUIRE_HOLD_MS=250;
const TRACK_GAP_MS=400;
const EDGE_GUARD=.027;
const MIN_HAND_SPACING=.085;

export class ZoneHandTracker {
 constructor(){this.reset();}
 reset(){
  this.tracks=[];this.current=[];this.nextRawId=1;this.zones=[];
  this.presence=new Map();this.owners=new Map();this.assigned=[];
 }
 get locked(){return this.zones.length>0;}
 get visibleCount(){return this.current.length;}
 getZones(){return this.zones.map(zone=>({...zone}));}
 // Diagnostics only: return all physical detections but label a hand ONLY
 // after normal, collision-safe in-lane reacquisition has accepted it.
 getTrackingSnapshot(){
  return {zones:this.getZones(),hands:this.current.map(hand=>({
   x:hand.palm.x,y:hand.palm.y,
   id:this.assigned.find(a=>Math.abs(a.x-hand.palm.x)<.00001&&
    Math.abs(a.y-hand.palm.y)<.00001)?.id??null
  }))};
 }
 // Diagnostic-only tip state: never authorizes a vote or player assignment.
 getCameraDiagnostics(){
  const labels=this.getTrackingSnapshot().hands;
  return this.current.map((h,i)=>({...labels[i],count:h.count,
   fingers:h.fingers??[],tips:h.tips??[]}));
 }
 candidates(now,holdMs=ENROLL_HOLD_MS){
  if(this.locked)return [];
  const active=this.current.filter(track=>now-track.lastAt<=TRACK_GAP_MS);
  return active.filter(track=>now-track.since>=holdMs &&
   !active.some(other=>other.rawId!==track.rawId &&
    Math.abs(other.palm.x-track.palm.x)<MIN_HAND_SPACING))
   .sort((a,b)=>a.palm.x-b.palm.x)
   .map(track=>({rawId:track.rawId,x:track.palm.x,y:track.palm.y,count:track.count,spread:track.spread}));
 }
 lockPlayers(now){
  if(this.locked)return this.getZones();
  const ready=this.candidates(now);
  if(!ready.length||ready.length!==this.current.length)return [];
  // Camera is mirrored in CSS; screenPoint applies the same horizontal flip.
  const centers=ready.map(hand=>hand.x);
  const bounds=[0,...centers.slice(0,-1).map((x,i)=>(x+centers[i+1])/2),1];
  this.zones=centers.map((center,i)=>({id:i+1,center,left:bounds[i],right:bounds[i+1]}));
  this.presence.clear();
  this.owners=new Map(ready.map((hand,i)=>[hand.rawId,i+1]));
  return this.getZones();
 }
 observe(landmarks,now){
  const detections=(landmarks||[]).slice(0,MAX_ZONE_PLAYERS)
   .map(points=>{
    const center=palmPoint(points);
    const fingers=fingerStates(points);
    const count=fingerCount(points);
    const tips=[4,8,12,16,20].map(i=>points[i]&&
     Number.isFinite(points[i].x)&&Number.isFinite(points[i].y)?
     screenPoint(points[i]):null);
    return center&&count!==null&&fingers?{palm:screenPoint(center),count,
     spread:fingers.slice(1).every(Boolean),fingers,tips}:null;
   }).filter(Boolean);
  const recent=this.tracks.filter(track=>now-track.lastAt<=TRACK_GAP_MS);
  const matched=nearestTrackMatching(recent.map(x=>x.palm),detections.map(x=>x.palm),.18);
  const used=new Set();
  const current=detections.map((d,i)=>{
   const match=matched.get(i);
   const previous=match===undefined?null:recent[match];
   if(previous)used.add(previous.rawId);
   return {rawId:previous?.rawId??this.nextRawId++,
    since:previous?.since??now,palm:d.palm,count:d.count,spread:d.spread,
    fingers:d.fingers,tips:d.tips,lastAt:now};
  });
  this.tracks=[...current,...recent.filter(t=>!used.has(t.rawId))];
  this.current=current;
  if(!this.locked){this.assigned=[];return [];}

  const buckets=new Map(this.zones.map(zone=>[zone.id,[]]));
  for(const hand of current){
   const zone=this.zones.find(z=>
    hand.palm.x>z.left+(z.left===0?0:EDGE_GUARD) &&
    hand.palm.x<z.right-(z.right===1?0:EDGE_GUARD));
   // A continuously tracked hand may NOT impersonate another lane.
   if(zone&&(!this.owners.has(hand.rawId)||this.owners.get(hand.rawId)===zone.id))
    buckets.get(zone.id).push(hand);
  }
  const assigned=[];
  for(const zone of this.zones){
   const matching=buckets.get(zone.id);
   if(matching.length!==1){
    this.presence.delete(zone.id);
    continue; // Crossing/overlapping hands must never transfer a vote.
   }
   const hand=matching[0],prior=this.presence.get(zone.id);
   const same=prior?.rawId===hand.rawId&&now-prior.lastAt<=TRACK_GAP_MS;
   const since=same?prior.since:now;
   this.presence.set(zone.id,{rawId:hand.rawId,since,lastAt:now});
   if(now-since<REACQUIRE_HOLD_MS)continue;
   assigned.push({id:zone.id,count:hand.count,spread:hand.spread,
    gesture:hand.count===0?"fist":"open",
    x:hand.palm.x,y:hand.palm.y,seen:now});
  }
  this.assigned=assigned;
  return assigned;
 }
}
