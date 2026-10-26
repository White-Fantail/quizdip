import test from "node:test";
import assert from "node:assert/strict";
import {fingerCount,isThumbExtended,raisedLongFingers,handGesture} from "../src/gestures.js";

// Synthetic anatomical poses, distinct from the existing generic 1–5
// fixtures. Palm width and orientation are intentional: never use just
// thumb-tip reach as proof of a fifth raised finger.
function palm(longFingers=0,thumb="folded"){
 const points=Array.from({length:21},()=>({x:.50,y:.64}));
 points[0]={x:.51,y:.93};
 for(const [i,tip,pip,mcp] of [[0,8,6,5],[1,12,10,9],[2,16,14,13],[3,20,18,17]]){
  const x=.41+i*.065;
  points[mcp]={x,y:.55};
  points[pip]={x,y:.42};
  points[tip]=i<longFingers?{x,y:.19}:{x:x+.015,y:.65};
 }
 points[2]={x:.37,y:.70};
 points[3]={x:.34,y:.63};
 points[4]=thumb==="open"?{x:.23,y:.54}:{x:.48,y:.60};
 return points;
}
const rotate=(points,angle)=>points.map(({x,y})=>({
 x:.5+(x-.5)*Math.cos(angle)-(y-.5)*Math.sin(angle),
 y:.5+(x-.5)*Math.sin(angle)+(y-.5)*Math.cos(angle)
}));
const mirror=points=>points.map(({x,y})=>({x:1-x,y}));
const shiftScale=(points,scale)=>points.map(({x,y})=>({x:.5+(x-.5)*scale,y:.5+(y-.5)*scale}));

test("a fist is zero, never one, even if thumb landmark looks outstretched",()=>{
 for(const thumb of ["folded","open"]){
  const pose=palm(0,thumb);
  assert.equal(raisedLongFingers(pose),0);
  assert.equal(fingerCount(pose),0);
  assert.equal(handGesture(pose),"fist");
 }
});
test("index-only is always answer 1; thumb cannot make it answer 2",()=>{
 for(const thumb of ["folded","open"]){
  const pose=palm(1,thumb);
  assert.equal(raisedLongFingers(pose),1);
  assert.equal(fingerCount(pose),1);
 }
});
test("all answer digits 1–4 count long fingers only",()=>{
 for(let n=0;n<=3;n++){
  for(const thumb of ["folded","open"])
   assert.equal(fingerCount(palm(n,thumb)),n);
 }
});
test("four tucked long fingers plus splayed thumb never creates a vote",()=>{
 const pose=palm(0,"open");
 assert.equal(isThumbExtended(pose),true);
 assert.equal(fingerCount(pose),0);
});
test("four-finger answer and five-finger neutral remain distinct",()=>{
 const four=palm(4,"folded"),five=palm(4,"open");
 assert.equal(isThumbExtended(four),false);
 assert.equal(isThumbExtended(five),true);
 assert.equal(fingerCount(four),4);
 assert.equal(fingerCount(five),5);
});
test("finger classifications are invariant under camera mirror, rotation and distance",()=>{
 for(const n of [0,1,2,3,4]){
  const p=palm(n,"folded");
  for(const candidate of [p,mirror(p),rotate(p,Math.PI/3),rotate(p,-Math.PI/2),shiftScale(p,.6)])
   assert.equal(fingerCount(candidate),n);
 }
 const five=palm(4,"open");
 for(const candidate of [five,mirror(five),rotate(five,Math.PI/3),rotate(five,-Math.PI/2),shiftScale(five,.6)])
  assert.equal(fingerCount(candidate),5);
});
test("a straight thumb across the palm is not a fifth finger",()=>{
 const pose=palm(4,"folded");
 // IP and tip can be almost collinear, but the tip remains on the
 // index/pinky side of the palm (not outside the index knuckle).
 pose[2]={x:.49,y:.67};
 pose[3]={x:.52,y:.61};
 pose[4]={x:.55,y:.55};
 assert.equal(isThumbExtended(pose),false);
 assert.equal(fingerCount(pose),4);
});
