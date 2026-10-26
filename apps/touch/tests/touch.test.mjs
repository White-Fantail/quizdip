import test from "node:test";
import assert from "node:assert/strict";
import {palmPoint,handGesture,nearestTrackMatching,answerAtPosition,screenPoint} from "../src/gestures.js";
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
test("max eight registered hands and one vote per player",()=>{
 const game=freshGame();for(let id=1;id<=9;id++)register(game,id);assert.equal(game.players.length,8);
 assert.ok(begin(game,1000));assert.ok(submit(game,1,DEMO_QUESTIONS[0].answer,2000));
 assert.equal(submit(game,1,0,2001),false);assert.ok(game.players[0].score>100);
 reveal(game);for(let i=1;i<DEMO_QUESTIONS.length;i++){advance(game,3000+i);reveal(game);}
 advance(game,9999);assert.equal(game.phase,"finished");
});

// Registration with an open palm must not be lost just because the hand opens again.
test("all registered hands must hold fists together, keeping open hands registered",()=>{
 const g=freshGame();register(g,11);register(g,22);
 let since=null;
 const observe=(hands,at)=>{const s=lobbyStartStatus(g,hands,at,since,1000);since=s.since;return s;};
 assert.equal(observe([{id:11,gesture:"open"},{id:22,gesture:"open"}],100).ready,false);
 assert.equal(g.players.length,2);
 assert.equal(observe([{id:11,gesture:"fist"},{id:22,gesture:"open"}],400).since,null);
 let result=observe([{id:11,gesture:"fist"},{id:22,gesture:"fist"}],500);
 assert.equal(result.ready,false);
 assert.equal(observe([{id:11,gesture:"fist"},{id:22,gesture:"fist"}],1499).ready,false);
 assert.equal(observe([{id:11,gesture:"fist"},{id:22,gesture:"open"}],1500).since,null);
 assert.equal(g.players.length,2,"open hand does not unregister");
 assert.equal(observe([{id:11,gesture:"fist"},{id:22,gesture:"fist"}],1600).since,1600);
 assert.equal(observe([{id:11,gesture:"fist"},{id:22,gesture:"fist"}],2600).ready,true);
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

function atX(points,x){
 const dx=x-.5;
 return points.map(p=>({x:p.x+dx,y:p.y}));
}
test("pinned hand rejoins with same ID after a fist and 1.5-second occlusion",()=>{
 const tracker=new HandTracker();
 const open=atX(fingers(true),.27),fist=atX(fingers(false),.27);
 let hands=tracker.update([open],100);
 const id=hands[0].id;
 hands=tracker.update([open],240);assert.equal(hands[0].gesture,"open");
 tracker.pin(id);
 hands=tracker.update([fist],400);
 hands=tracker.update([fist],530);assert.equal(hands[0].gesture,"fist");
 tracker.update([],1100);
 assert.equal(tracker.find(id)?.id,id,"pin preserves track");
 hands=tracker.update([open],2050);
 assert.equal(hands.length,1);
 assert.equal(hands[0].id,id,"same hand reconnects without a second player");
 assert.equal(tracker.tracks.filter(t=>t.id===id).length,1);
});
test("two pinned hands retain distinct IDs after brief occlusion and changed detection order",()=>{
 const tracker=new HandTracker();
 const a=atX(fingers(true),.22),b=atX(fingers(true),.78);
 const first=tracker.update([a,b],100),aId=first[0].id,bId=first[1].id;
 tracker.setPinnedIds([aId,bId]);
 tracker.update([],300);
 const recovered=tracker.update([atX(fingers(false),.79),atX(fingers(false),.21)],1550);
 assert.deepEqual(recovered.map(x=>x.id),[bId,aId]);
});
test("a registered hand does not expire during a long gap while unregistered ghosts do",()=>{
 const tracker=new HandTracker();
 const initial=tracker.update([atX(fingers(true),.34),atX(fingers(true),.77)],0);
 tracker.pin(initial[0].id);
 tracker.update([],3000);
 assert.equal(tracker.tracks.length,1);
 assert.equal(tracker.find(initial[0].id)?.id,initial[0].id);
});
test("ambiguous overlapping hands do not inherit a possibly wrong registered ID",()=>{
 const tracker=new HandTracker();
 const first=tracker.update([atX(fingers(true),.3),atX(fingers(true),.7)],100);
 tracker.setPinnedIds(first.map(x=>x.id));
 tracker.update([],500);
 const observations=tracker.update([atX(fingers(true),.5)],2600);
 assert.ok(observations.every(x=>!first.some(old=>old.id===x.id)));
 assert.equal(tracker.tracks.filter(t=>tracker.pinnedIds.has(t.id)).length,2);
});
