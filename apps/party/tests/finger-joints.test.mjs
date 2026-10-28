import test from "node:test";
import assert from "node:assert/strict";
import {fingerCount,longFingerStates,fingerStates,raisedLongFingers} from "../src/gestures.js";
function smallHand(raised=[]){
 const p=Array.from({length:21},()=>({x:.5,y:.67}));
 p[0]={x:.50,y:.92};
 for(const [i,[mcp,pip,tip]] of [[5,6,8],[9,10,12],[13,14,16],[17,18,20]].entries()){
  const x=.395+i*.07;
  p[mcp]={x,y:.53};p[pip]={x,y:.41};
  // Shortened or naturally curled child's finger: old 1.16 wrist ratio fails.
  p[tip]=raised.includes(i)?{x,y:.35}:{x:x+.02,y:.66};
 }
 p[2]={x:.34,y:.68};p[3]={x:.30,y:.63};p[4]={x:.49,y:.64};
 return p;
}
const mirror=points=>points.map(p=>({x:1-p.x,y:p.y}));
const rotate=(points,a)=>points.map(({x,y})=>({
 x:.5+(x-.5)*Math.cos(a)-(y-.5)*Math.sin(a),
 y:.5+(x-.5)*Math.sin(a)+(y-.5)*Math.cos(a)
}));
const shrink=points=>points.map(({x,y})=>({x:.5+(x-.5)*.38,y:.5+(y-.5)*.38}));

test("each individual shorter finger reliably registers as one",()=>{
 for(let i=0;i<4;i++){
  const p=smallHand([i]);
  assert.deepEqual(longFingerStates(p),[0,1,2,3].map(j=>j===i));
  assert.equal(raisedLongFingers(p),1);
  assert.equal(fingerCount(p),1);
 }
});
test("every finger combination, mirror, rotation and scale stays consistent",()=>{
 for(let mask=0;mask<16;mask++){
  const raised=[0,1,2,3].filter(i=>(mask>>i)&1),p=smallHand(raised);
  assert.equal(fingerCount(p),raised.length);
  assert.deepEqual(fingerStates(p).slice(1),[0,1,2,3].map(i=>raised.includes(i)));
  for(const candidate of [mirror(p),rotate(p,Math.PI/3),shrink(p)])
   assert.equal(fingerCount(candidate),raised.length);
 }
});
test("fists and folded fingertips at PIP do not become false answers",()=>{
 const p=smallHand([]);
 assert.equal(fingerCount(p),0);
 for(const tip of [8,12,16,20])p[tip]={x:p[tip-3].x,y:.40};
 assert.equal(fingerCount(p),0);
});
