import test from "node:test";
import assert from "node:assert/strict";
import {palmPoint,handGesture,nearestTrackMatching,answerAtPosition,screenPoint,fingerCount} from "../src/gestures.js";
import {foldSelection} from "../src/selection.js";
import {HandTracker} from "../src/tracker.js";
import {freshGame,register,begin,submit,reveal,advance,DEMO_QUESTIONS,lobbyStartStatus} from "../src/game.js";
function fingers(extended){
 const pts=Array.from({length:21},()=>({x:.5,y:.55}));pts[0]={x:.5,y:.9};
 for(const [i,tip,pip] of [[0,8,6],[1,12,10],[2,16,14],[3,20,18]]){
  pts[pip]={x:.5+i*.01,y:.55};pts[tip]={x:.5+i*.01,y:extended? .19:.66};
 }
 return pts;
}
test("recognizes open hands and fists",()=>{assert.equal(handGesture(fingers(true)),"open");assert.equal(handGesture(fingers(false)),"fist");assert.ok(palmPoint(fingers(true)));});
test("camera mirror and hit testing",()=>{assert.equal(screenPoint({x:.2,y:.8}).x,.8);assert.equal(answerAtPosition(50,80,[{left:0,top:0,right:100,bottom:100}]),0);});
test("distinct tracks matched once",()=>{const m=nearestTrackMatching([{x:.1,y:.1},{x:.9,y:.9}],[{x:.88,y:.9},{x:.12,y:.13}]);assert.equal(m.get(0),1);assert.equal(m.get(1),0);});
test("five fixed finger-number slots (1..5) and only one vote",()=>{
 const game=freshGame();for(let id=1;id<=9;id++)register(game,id);assert.equal(game.players.length,5);
 assert.ok(begin(game,1000));assert.ok(submit(game,1,DEMO_QUESTIONS[0].answer,2000));
 assert.equal(submit(game,1,0,2001),false);assert.ok(game.players[0].score>100);
 reveal(game);for(let i=1;i<DEMO_QUESTIONS.length;i++){advance(game,3000+i);reveal(game);}
 advance(game,9999);assert.equal(game.phase,"finished");
});

// Registration with an open palm must not be lost just because the hand opens again.
test("all registered hands must hold fists together, keeping open hands registered",()=>{
 const g=freshGame();register(g,1);register(g,2);
 let since=null;
 const observe=(hands,at)=>{const s=lobbyStartStatus(g,hands,at,since,1000);since=s.since;return s;};
 assert.equal(observe([{id:1,gesture:"open"},{id:2,gesture:"open"}],100).ready,false);
 assert.equal(g.players.length,2);
 assert.equal(observe([{id:1,gesture:"fist"},{id:2,gesture:"open"}],400).since,null);
 let result=observe([{id:1,gesture:"fist"},{id:2,gesture:"fist"}],500);
 assert.equal(result.ready,false);
 assert.equal(observe([{id:1,gesture:"fist"},{id:2,gesture:"fist"}],1499).ready,false);
 assert.equal(observe([{id:1,gesture:"fist"},{id:2,gesture:"open"}],1500).since,null);
 assert.equal(g.players.length,2,"open hand does not unregister");
 assert.equal(observe([{id:1,gesture:"fist"},{id:2,gesture:"fist"}],1600).since,1600);
 assert.equal(observe([{id:1,gesture:"fist"},{id:2,gesture:"fist"}],2600).ready,true);
 assert.ok(begin(g,2600));
 assert.equal(g.phase,"playing");
});
test("missing and unregistered hands block auto-start; starting with no players is forbidden",()=>{
 const g=freshGame();
 assert.equal(lobbyStartStatus(g,[],1000).ready,false);
 register(g,1);register(g,2);
 assert.equal(lobbyStartStatus(g,[{id:1,gesture:"fist"}],2000,1000).ready,false);
 assert.equal(lobbyStartStatus(g,[{id:1,gesture:"fist"},{id:2,gesture:"fist"},{id:3,gesture:"fist"}],2000,1000).ready,false);
 assert.equal(lobbyStartStatus(g,[{id:1,gesture:"fist"},{id:2,gesture:"fist"}],2000,1000).ready,true);
});

function numberedPose(n, x=.5){
 const pts=Array.from({length:21},()=>({x,y:.67}));
 pts[0]={x,y:.92};
 for(const [position,tip,pip,mcp] of [[0,8,6,5],[1,12,10,9],[2,16,14,13],[3,20,18,17]]){
  const xx=x+(position-1.5)*.07;
  pts[mcp]={x:xx,y:.53};pts[pip]={x:xx,y:.40};
  pts[tip]=position<n?{x:xx,y:.20}:{x:xx+.025,y:.66};
 }
 pts[2]={x:x-.26,y:.61};pts[3]={x:x-.29,y:.56};
 pts[4]=n===5?{x:x-.42,y:.42}:{x:x-.13,y:.62};
 return pts;
}
function wave(tracker,numbers,start=100,step=130){
 let out=[];
 for(let i=0;i<8;i++)out=tracker.update(numbers.map(([n,x])=>numberedPose(n,x)),start+step*i);
 return out;
}
test("canonical one-to-five finger gestures are classified distinctly",()=>{
 for(let n=0;n<=5;n++){
  assert.equal(fingerCount(numberedPose(n)),n,"finger count "+n);
  assert.equal(handGesture(numberedPose(n)),n===0?"fist":"open");
 }
});
test("enrollment requires a held, unique finger count",()=>{
 const tracker=new HandTracker();tracker.setRegistered([1,3,5]);
 tracker.update([numberedPose(1,.22),numberedPose(3,.51),numberedPose(5,.80)],100);
 assert.equal(tracker.candidates(200,780).length,0,"brief passing hand cannot register");
 wave(tracker,[[1,.22],[3,.51],[5,.80]],220);
 const candidates=tracker.candidates(1130,780);
 assert.deepEqual(candidates.map(h=>h.id).sort(),[1,3,5]);
 const seen=tracker.update([numberedPose(1,.22),numberedPose(3,.51),numberedPose(5,.80)],1140);
 assert.deepEqual(seen.map(h=>h.id).sort(),[1,3,5]);
});
test("after detection loss, player identity recovers by number even if positions swap",()=>{
 const tracker=new HandTracker();tracker.setRegistered([1,2]);
 wave(tracker,[[1,.24],[2,.76]],100);
 assert.deepEqual(tracker.update([numberedPose(1,.24),numberedPose(2,.76)],1050).map(h=>h.id),[1,2]);
 tracker.update([],1500);
 assert.deepEqual(tracker.update([numberedPose(2,.24),numberedPose(1,.76)],2200),[]);
 let result=wave(tracker,[[2,.24],[1,.76]],2320);
 assert.deepEqual(result.map(h=>h.id),[2,1],"gesture count wins over previous screen side");
});
test("an unverified fist cannot impersonate a registered player",()=>{
 const tracker=new HandTracker();tracker.setRegistered([1,2]);
 assert.deepEqual(wave(tracker,[[0,.27]],100),[]);
});
test("registered fist retains ID during a continuous fold and is lost on real occlusion",()=>{
 const tracker=new HandTracker();tracker.setRegistered([4]);
 wave(tracker,[[4,.42]],100);
 const confirmed=tracker.update([numberedPose(4,.42)],1100);
 assert.equal(confirmed[0].id,4);
 let hands=tracker.update([numberedPose(0,.42)],1200);
 assert.equal(hands[0].id,4);
 hands=tracker.update([numberedPose(0,.42)],1380);
 assert.equal(hands[0].gesture,"fist");
 tracker.update([],1800);
 assert.equal(tracker.update([numberedPose(0,.42)],2200).length,0,
  "returning fist alone cannot establish player");
 assert.equal(tracker.update([numberedPose(4,.42)],2350).length,0);
 const returned=wave(tracker,[[4,.42]],2450);
 assert.equal(returned[0].id,4);
});
test("overlapping hands do not keep an unverified player identity",()=>{
 const tracker=new HandTracker();tracker.setRegistered([1,2]);
 wave(tracker,[[1,.22],[2,.78]],100);
 tracker.update([],1600);
 const together=tracker.update([numberedPose(1,.48),numberedPose(2,.51)],1750);
 assert.deepEqual(together,[],"nearby hands cannot earn points");
 const restored=wave(tracker,[[1,.22],[2,.78]],1900);
 assert.deepEqual(restored.map(h=>h.id).sort(),[1,2]);
});
const hand=(n,gesture="open")=>({id:2,count:n,gesture});
test("passing over an option NEVER chooses, even after a long hover",()=>{
 let state;
 for(let ms=0;ms<=4500;ms+=250){
  const result=foldSelection(state,hand(2),1,ms);state=result.state;
  assert.equal(result.chosen,null);
 }
});
test("fold must be deliberate, preceded by own-number pose inside SAME option",()=>{
 let state;
 let r=foldSelection(state,hand(2),0,100);state=r.state;
 r=foldSelection(state,hand(2),0,310);state=r.state;
 assert.equal(r.chosen,null);
 r=foldSelection(state,hand(0,"fist"),0,500);state=r.state;
 r=foldSelection(state,hand(0,"fist"),0,680);
 assert.equal(r.chosen,0,"fist after armed number confirms");
 r=foldSelection(undefined,hand(0,"fist"),1,1000);
 assert.equal(r.chosen,null,"already-closed fist moving over another answer does nothing");
});
test("crossing to a different option while closing must not vote",()=>{
 let state=foldSelection(undefined,hand(2),0,0).state;
 state=foldSelection(state,hand(2),0,200).state;
 let r=foldSelection(state,hand(0,"fist"),1,400);
 assert.equal(r.chosen,null);
 r=foldSelection(r.state,hand(0,"fist"),1,640);
 assert.equal(r.chosen,null);
});
test("loss of identity clears pending fold; reacquisition needs explicit re-arm",()=>{
 let state=foldSelection(undefined,hand(2),2,0).state;
 state=foldSelection(state,hand(2),2,200).state;
 state=foldSelection(state,null,null,300).state;
 const r=foldSelection(state,hand(0,"fist"),2,600);
 assert.equal(r.chosen,null);
});

test("folding P5 through a temporary four-finger pose does not switch to P4",()=>{
 const tracker=new HandTracker();tracker.setRegistered([4,5]);
 wave(tracker,[[5,.42]],100);
 let hands=tracker.update([numberedPose(4,.42)],1150);
 assert.equal(hands[0]?.id,5);
 // The camera still delivers frames as the fingers are slowly folded.
 tracker.update([numberedPose(4,.42)],1280);
 tracker.update([numberedPose(4,.42)],1410);
 hands=tracker.update([numberedPose(4,.42)],1540);
 assert.equal(hands[0]?.id,5,"transient partial fold keeps P5");
 hands=tracker.update([numberedPose(0,.42)],1640);
 hands=tracker.update([numberedPose(0,.42)],1800);
 assert.equal(hands[0]?.id,5);
 assert.equal(hands[0]?.gesture,"fist");
});
