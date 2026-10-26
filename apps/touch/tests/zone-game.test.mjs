import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ZoneHandTracker,ENROLL_HOLD_MS,REACQUIRE_HOLD_MS} from "../src/zone-tracker.js";
import {fingerVote,NEUTRAL_HOLD_MS,SELECT_ARM_MS,SELECT_COUNTDOWN_MS} from "../src/finger-vote.js";
import {raisedLongFingers,isThumbExtended,fingerCount} from "../src/gestures.js";
import {updateLobbyHold,LOCK_HOLD_MS,LAUNCH_HOLD_MS} from "../src/lobby-hands.js";

function pose(n,x=.5){
 const pts=Array.from({length:21},()=>({x,y:.67}));
 pts[0]={x,y:.92};
 for(const [position,tip,pip,mcp] of [[0,8,6,5],[1,12,10,9],[2,16,14,13],[3,20,18,17]]){
  const xx=x+(position-1.5)*.07;
  pts[mcp]={x:xx,y:.53};pts[pip]={x:xx,y:.4};
  pts[tip]=position<n?{x:xx,y:.2}:{x:xx+.025,y:.66};
 }
 pts[2]={x:x-.26,y:.61};pts[3]={x:x-.29,y:.56};
 pts[4]=n===5?{x:x-.42,y:.42}:{x:x-.13,y:.62};
 return pts;
}
function scan(tracker,inputs,start=0){
 let result;
 for(let i=0;i<11;i++)result=tracker.observe(inputs.map(([n,x])=>pose(n,x)),start+i*100);
 return result;
}
function finger(n,id=1){return {id,count:n,gesture:n===0?"fist":"open"};}

test("recognition takes time; one to five hands yield equal-count physical seats",()=>{
 for(let number=1;number<=5;number++){
  const tracker=new ZoneHandTracker();
  const positions=Array.from({length:number},(_,i)=>.12+i*(.76/Math.max(1,number-1)));
  const inputs=positions.map(x=>[1,x]);
  tracker.observe(inputs.map(([n,x])=>pose(n,x)),0);
  assert.equal(tracker.lockPlayers(10).length,0,"premature lock is refused");
  scan(tracker,inputs,100);
  const zones=tracker.lockPlayers(1200);
  assert.equal(zones.length,number);
  assert.deepEqual(zones.map(z=>z.id),Array.from({length:number},(_,i)=>i+1));
  assert.equal(zones[0].left,0);assert.equal(zones.at(-1).right,1);
  for(let i=1;i<zones.length;i++)assert.equal(zones[i].left,zones[i-1].right);
 }
 assert.equal(ENROLL_HOLD_MS,800);
});

test("identical finger numbers identify different camera-lane players",()=>{
 const tracker=new ZoneHandTracker();
 scan(tracker,[[1,.25],[1,.50],[1,.75]]);
 assert.equal(tracker.lockPlayers(1200).length,3);
 let output=[];
 for(let t=1300;t<=1800;t+=100)
  output=tracker.observe([pose(2,.25),pose(4,.5),pose(3,.75)],t);
 assert.equal(output.length,3);
 // Screen is mirrored: sensor rightmost becomes P1.
 assert.deepEqual(output.map(h=>[h.id,h.count]),[[1,3],[2,4],[3,2]]);
 assert.equal(REACQUIRE_HOLD_MS,250);
});

test("crossing a locked boundary does not switch an observed hand to another person",()=>{
 const tracker=new ZoneHandTracker();
 scan(tracker,[[1,.23],[1,.77]]);tracker.lockPlayers(1200);
 for(let t=1300;t<=1700;t+=100)tracker.observe([pose(1,.23),pose(1,.77)],t);
 let output=[];
 for(let t=1800;t<=2300;t+=100)
  output=tracker.observe([pose(1,.64),pose(1,.77)],t);
 assert.ok(output.every(h=>h.id===1),"P2's physical hand cannot become P1 by crossing");
});

test("newly reappearing hands must settle before earning player attribution",()=>{
 const tracker=new ZoneHandTracker();
 scan(tracker,[[1,.3]]);tracker.lockPlayers(1200);
 for(let t=1300;t<=1700;t+=100)tracker.observe([pose(1,.3)],t);
 tracker.observe([],2500);
 assert.deepEqual(tracker.observe([pose(2,.3)],2600),[]);
 assert.deepEqual(tracker.observe([pose(2,.3)],2800),[]);
 assert.equal(tracker.observe([pose(2,.3)],2900)[0]?.id,1);
});

test("five fingers arm each round; holding a previous answer alone never auto-votes",()=>{
 let s=null;
 for(let t=0;t<2000;t+=100)s=fingerVote(s,finger(2),t).state;
 assert.equal(s.phase,"neutral");
 s=fingerVote(s,finger(5),2000).state;
 s=fingerVote(s,finger(5),2000+NEUTRAL_HOLD_MS).state;
 assert.equal(s.phase,"ready");
 s=fingerVote(s,finger(2),2500).state;
 assert.equal(s.phase,"arming");
 let result;
 for(let t=2600;t<=3900;t+=100){
  result=fingerVote(s,finger(2),t);
  s=result.state;
  if(result.chosen!==null)break;
 }
 assert.equal(result.chosen,1);
 assert.equal(SELECT_COUNTDOWN_MS,1000);
});

test("a different answer restarts the per-player dwell countdown",()=>{
 let s=fingerVote(null,finger(5),0).state;
 s=fingerVote(s,finger(5),300).state;
 s=fingerVote(s,finger(4),400).state;
 for(let t=500;t<=800;t+=100)s=fingerVote(s,finger(4),t).state;
 assert.equal(s.phase,"countdown");
 s=fingerVote(s,finger(1),900).state;
 assert.equal(s.phase,"arming");assert.equal(s.choice,0);
 assert.equal(fingerVote(s,finger(1),1000).chosen,null);
});

test("missing hand longer than grace resets readiness and cancels vote",()=>{
 let s=fingerVote(null,finger(5),0).state;
 s=fingerVote(s,finger(5),300).state;
 s=fingerVote(s,finger(1),400).state;
 s=fingerVote(s,null,500).state;
 s=fingerVote(s,null,900).state;
 assert.equal(s.phase,"neutral");
 assert.equal(fingerVote(s,finger(1),1000).chosen,null);
});

test("Touch bottom board uses recognized dynamic player-count columns",()=>{
 const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 assert.match(css,/grid-template-columns:repeat\(var\(--player-count,1\),minmax\(0,1fr\)\)/);
 assert.match(main,/board\.style\.setProperty\("--player-count"/);
 assert.match(main,/tracker\.lockPlayers\(performance\.now\(\)\)/);
 assert.match(main,/numHands:MAX_ZONE_PLAYERS/);
 assert.doesNotMatch(main,/new HandTracker\(/);
 assert.doesNotMatch(main,/horizontalControl\(/);
 assert.doesNotMatch(main,/dwellSelection\(/);
});

test("open palm counts five even with natural short thumb splay and wrist rotation",()=>{
 const points=pose(5,.52);
 assert.equal(raisedLongFingers(points),4);
 assert.equal(isThumbExtended(points),true);
 assert.equal(fingerCount(points),5);
 const folded=pose(4,.52);
 assert.equal(raisedLongFingers(folded),4);
 assert.equal(isThumbExtended(folded),false);
 assert.equal(fingerCount(folded),4);

 // Less extreme real-world thumb geometry: thumb tip only slightly farther
 // from the index base than the thumb IP joint. Old 1.32x/1.52x tests failed.
 points[0]={x:.50,y:.88};
 points[2]={x:.37,y:.70};points[3]={x:.29,y:.62};points[4]={x:.20,y:.55};
 points[5]={x:.43,y:.52};points[17]={x:.68,y:.54};
 assert.equal(isThumbExtended(points),true);
 assert.equal(fingerCount(points),5);
 // Rotation/reflection preserves all distance-based decisions.
 const reflected=points.map(p=>({x:1-p.x,y:p.y}));
 assert.equal(fingerCount(reflected),5);
});

test("hands-only countdown automatically locks and starts without touching a button",()=>{
 let state=null,out;
 const first=[{rawId:7,spread:true},{rawId:9,spread:true}];
 for(let now=0;now<=LOCK_HOLD_MS;now+=100){
  out=updateLobbyHold(state,"scanning",first,2,now);state=out;
  if(now<LOCK_HOLD_MS)assert.equal(out.action,null);
 }
 assert.equal(out.action,"lock");
 state=null;
 const players=[{id:1,spread:true},{id:2,spread:true}];
 for(let now=4000;now<=4000+LAUNCH_HOLD_MS;now+=100){
  out=updateLobbyHold(state,"locked",players,2,now);state=out;
 }
 assert.equal(out.action,"start");
});

test("additional, missing, curled, or overlapping hands reset lobby progress",()=>{
 let state=null;
 const one=[{rawId:1,spread:true}],two=[...one,{rawId:2,spread:true}];
 for(let t=0;t<1500;t+=100)state=updateLobbyHold(state,"scanning",one,1,t);
 assert.ok(state.progress>0);
 state=updateLobbyHold(state,"scanning",two,2,1500);
 assert.equal(state.progress,0,"new player restarts countdown");
 state=updateLobbyHold(state,"scanning",[two[0]],2,1700);
 assert.equal(state.progress,0,"missing hand resets countdown");
 state=updateLobbyHold(state,"scanning",[{rawId:1,spread:false}],1,1800);
 assert.equal(state.progress,0,"folded hand resets countdown");
 state=updateLobbyHold(state,"locked",[{id:1,spread:true}],2,1900);
 assert.equal(state.action,null);
 assert.equal(state.progress,0);
});

test("Touch lobby has hands-only progress and start wiring",()=>{
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
 assert.match(main,/updateLobbyHold\(lobbyHold,"scanning"/);
 assert.match(main,/updateLobbyHold\(lobbyHold,"locked"/);
 assert.match(main,/if\(lobbyHold\.action==="lock"\)confirmPlayers\(\)/);
 assert.match(main,/if\(lobbyHold\.action==="start"\)startRecognizedGame\(\)/);
 assert.match(css,/lobby-hands-track/);
});
