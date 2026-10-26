import test from "node:test";
import assert from "node:assert/strict";
import {palmPoint,handGesture,nearestTrackMatching,answerAtPosition,screenPoint,screenControlPoint,fingerCount} from "../src/gestures.js";
import {horizontalControl,CALIBRATION_MS,NEUTRAL_DEAD_ZONE} from "../src/horizontal-controls.js";
import {readFileSync} from "node:fs";
import {replayDwell} from "../src/replay.js";
import {dwellSelection,SELECT_ARM_MS,SELECT_COUNTDOWN_MS} from "../src/selection.js";
import {updateStartPads,START_HOLD_MS} from "../src/start-zones.js";
import {HandTracker} from "../src/tracker.js";
import {freshGame,setQuestions,register,begin,submit,reveal,advance,TOUCH_COUNT,ROUND_MS} from "../src/game.js";
import {validateTouchSet,touchApiEndpoint} from "../src/source.js";
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
const realQuestions=Array.from({length:TOUCH_COUNT},(_,i)=>({
 id:"quiz-"+i,title:"Real question",prompt:"Which answer?",clue:null,mediaId:null,
 version:1,options:["One","Two","Three","Four"],answer:{canonical:"Three",aliases:[],responseMode:"multiple-choice"}
}));
test("five fixed finger-number slots and one locally graded vote",()=>{
 const game=freshGame();for(let id=1;id<=9;id++)register(game,id);assert.equal(game.players.length,5);
 assert.equal(begin(game,1000),false,"No bundled fake questions may be played");
 assert.ok(setQuestions(game,realQuestions));
 assert.ok(begin(game,1000));assert.ok(submit(game,1,2,2000));
 assert.equal(submit(game,1,0,2001),false);
 assert.equal(game.players[0].score,0,"Answer is scored only after round concludes");
 assert.ok(reveal(game));
 assert.ok(game.players[0].score>100);
 for(let i=1;i<TOUCH_COUNT;i++){
  assert.ok(advance(game,3000+i));
  assert.ok(reveal(game));
 }
 advance(game,9999);assert.equal(game.phase,"finished");
});

// Registration with an open palm must not be lost just because the hand opens again.

const openHand=(id,x=id/10,y=.55)=>({id,count:id,gesture:"open",x,y});
const personalPad=(id,hand)=>hand.x===id/10;
test("each player starts only by holding their OWN separated start zone",()=>{
 let status=updateStartPads(null,[1,2],[openHand(1),openHand(2)],personalPad,100);
 assert.equal(status.start,false);
 assert.equal(status.insideCount,2);
 status=updateStartPads(status.holds,[1,2],[openHand(1),openHand(2)],personalPad,100+START_HOLD_MS-1);
 assert.equal(status.start,false);
 status=updateStartPads(status.holds,[1,2],[openHand(1),openHand(2)],personalPad,100+START_HOLD_MS);
 // A missing camera frame over 320ms invalidates old accumulated time.
 assert.equal(status.start,false);
 let now=100+START_HOLD_MS;
 status=updateStartPads(null,[1,2],[openHand(1),openHand(2)],personalPad,now);
 for(let i=0;i<15;i++){now+=100;status=updateStartPads(status.holds,[1,2],[openHand(1),openHand(2)],personalPad,now);}
 assert.equal(status.start,true);
 assert.equal(status.readyCount,2);
});
test("wrong number, wrong zone and missing player cancel start automatically",()=>{
 let status=updateStartPads(null,[1,2],[openHand(1),openHand(2,.9)],personalPad,100);
 assert.equal(status.insideCount,1);
 assert.equal(status.start,false);
 status=updateStartPads(status.holds,[1,2],[openHand(1),{...openHand(2),count:1}],personalPad,300);
 assert.equal(status.insideCount,1);
 status=updateStartPads(status.holds,[1,2],[openHand(1)],personalPad,350);
 assert.equal(status.readyCount,0);
 assert.equal(status.start,false);
 status=updateStartPads(status.holds,[1,2],[],personalPad,400);
 assert.equal(status.holds.size,0);
});
test("no unregistered extra finger pose can join already-started game",()=>{
 const g=freshGame();register(g,1);setQuestions(g,realQuestions);begin(g,100);
 assert.equal(register(g,2),false);
 assert.equal(g.endTime,100+ROUND_MS);
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

const hand=(id,option=0)=>({id,count:id,gesture:"open",option});
test("a passing hand or brief hover never chooses any answer",()=>{
 const results=[0,80,160,280,500].map(at=>dwellSelection(undefined,hand(2),1,at));
 assert.ok(results.every(result=>result.chosen===null));
 const first=dwellSelection(null,hand(2),1,0);
 assert.equal(first.state.phase,"arming");
});
test("countdown starts after stable dwell and confirms ONLY after the full countdown",()=>{
 let state=null,result;
 for(let ms=0;ms<=2600;ms+=100){
  result=dwellSelection(state,hand(2),1,ms);state=result.state;
  if(ms<SELECT_ARM_MS)assert.equal(result.chosen,null);
  if(ms>=SELECT_ARM_MS&&ms<SELECT_ARM_MS+SELECT_COUNTDOWN_MS){
   assert.equal(state.phase,"countdown");
   assert.ok(state.progress>=0&&state.progress<1);
  }
  if(result.chosen!==null)break;
 }
 assert.equal(result.chosen,1);
 assert.equal(state,null);
});
test("switching from A to B restarts countdown; it cannot vote on flyover",()=>{
 let state=null;
 for(let ms=0;ms<=1700;ms+=100)state=dwellSelection(state,hand(3),0,ms).state;
 const switched=dwellSelection(state,hand(3),3,1800);
 assert.equal(switched.chosen,null);
 assert.equal(switched.state.enteredAt,1800);
 assert.equal(switched.state.phase,"arming");
});
test("lost number pose, closed fist, missing hand or camera pause DISARMS selection",()=>{
 let state=null;
 for(let ms=0;ms<=1000;ms+=100)state=dwellSelection(state,hand(4),2,ms).state;
 assert.equal(dwellSelection(state,{id:4,count:3,gesture:"open"},2,1100).state,null);
 assert.equal(dwellSelection(state,{id:4,count:0,gesture:"fist"},2,1100).state,null);
 assert.equal(dwellSelection(state,null,null,1100).state,null);
 const paused=dwellSelection(state,hand(4),2,1850);
 assert.equal(paused.state.phase,"arming");
 assert.equal(paused.chosen,null);
});
test("independent players can display simultaneous separate countdowns",()=>{
 let a=null,b=null;
 for(let ms=0;ms<=1300;ms+=100){
  a=dwellSelection(a,hand(1),0,ms).state;
  b=dwellSelection(b,hand(5),0,ms).state;
 }
 assert.equal(a.phase,"countdown");
 assert.equal(b.phase,"countdown");
 assert.equal(a.remainingMs,b.remainingMs);
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

test("one dropped inference during fist retains same number but never registers a ghost",()=>{
 const tracker=new HandTracker();tracker.setRegistered([4]);
 wave(tracker,[[4,.40]],100);
 assert.equal(tracker.update([],1100).length,0);
 assert.equal(tracker.candidates(1100).length,0,"lost hand cannot register another player");
 const hand=tracker.update([numberedPose(0,.40)],1220);
 assert.equal(hand[0]?.id,4,"one missed frame retains physical track");
 const closed=tracker.update([numberedPose(0,.40)],1390);
 assert.equal(closed[0]?.gesture,"fist");
});

test("answer arm is 0.4s and countdown lasts exactly 1.0s",()=>{
 assert.equal(SELECT_ARM_MS,400);
 assert.equal(SELECT_COUNTDOWN_MS,1000);
 const h={id:3,count:3,gesture:"open"};
 let result=dwellSelection(null,h,2,1000);
 result=dwellSelection(result.state,h,2,1399);
 assert.equal(result.state.phase,"arming");
 assert.equal(result.chosen,null);
 result=dwellSelection(result.state,h,2,1400);
 assert.equal(result.state.phase,"countdown");
 assert.equal(result.state.remainingMs,1000);
 result=dwellSelection(result.state,h,2,1900);
 assert.equal(result.chosen,null);
 result=dwellSelection(result.state,h,2,2399);
 assert.equal(result.chosen,null);
 assert.equal(result.state.remainingMs,1);
 result=dwellSelection(result.state,h,2,2400);
 assert.equal(result.chosen,2);
 assert.equal(result.state,null);
});
test("moving to another answer during 1-second countdown cancels previous answer",()=>{
 const h={id:2,count:2,gesture:"open"};
 let r=dwellSelection(null,h,0,0);
 r=dwellSelection(r.state,h,0,400);
 r=dwellSelection(r.state,h,1,900);
 assert.equal(r.chosen,null);
 assert.equal(r.state.choice,1);
 assert.equal(r.state.phase,"arming");
 r=dwellSelection(r.state,h,1,1299);
 assert.equal(r.chosen,null);
 assert.equal(r.state.phase,"arming");
});

// Regression: the screen cursor tracks raised fingertips, not the lower palm.
test("finger-tip target mirrors correctly and expands top-screen reach",()=>{
 const p=numberedPose(1,.5),point=screenControlPoint(p);
 assert.ok(point);
 const tip=p[8],expectedX=Math.max(0,Math.min(1,((1-tip.x)-.10)/.80));
 assert.ok(Math.abs(point.x-expectedX)<1e-9);
 assert.ok(point.y<screenPoint(palmPoint(p)).y-.3,"top choices reachable without lifting the entire palm");
 assert.ok(Math.abs(screenControlPoint(fingers(true)).x-.5)<.1);
 assert.equal(screenControlPoint([]),null);
});
test("replay needs exactly one held hand, never every previous player",()=>{
 const rect={left:300,right:700,top:200,bottom:550};
 const inside={id:3,count:3,x:500,y:350},outside={id:1,count:1,x:100,y:350};
 let state=null,step;
 for(let t=0;t<=1400;t+=100){
  step=replayDwell(state,[inside],rect,t);
  if(t<1400)assert.equal(step.restart,false);
  state=step.state;
 }
 assert.equal(step.restart,true);
 assert.equal(step.state,null);
 assert.equal(replayDwell(null,[outside],rect,0).restart,false);
 let lost=replayDwell(null,[inside],rect,100).state;
 lost=replayDwell(lost,[],rect,200).state;
 assert.equal(lost,null,"losing the hand cancels the hover");
});
test("replay cannot inherit another hand's countdown",()=>{
 const rect={left:0,top:0,right:800,bottom:800};
 let state=null;
 for(let t=0;t<=800;t+=100)state=replayDwell(state,[{id:2,count:2,x:400,y:400}],rect,t).state;
 const changed=replayDwell(state,[{id:4,count:4,x:400,y:400}],rect,900);
 assert.equal(changed.restart,false);
 assert.equal(changed.state.id,4);
 assert.equal(changed.state.phase,"arming");
});

test("only a complete ten-question QuizDip set can start",()=>{
 const payload={ticket:"opaque",locale:"ko",lane:"GENERAL",questions:realQuestions};
 assert.equal(validateTouchSet(payload),payload);
 assert.throws(()=>validateTouchSet({...payload,questions:realQuestions.slice(0,8)}));
 assert.throws(()=>validateTouchSet({...payload,questions:[
  {...realQuestions[0],options:["Invalid"]},...realQuestions.slice(1)
 ]}));
});
test("preview override accepts only trusted QuizDip hosts",()=>{
 const dev="https://quizdip-xyz-nomadonghos-projects.vercel.app/api/touch";
 const partyDev="https://quizdip-xyz-nomadonghos-projects.vercel.app/api/party";
 assert.equal(touchApiEndpoint("?partyApi="+encodeURIComponent(partyDev)),partyDev);
 assert.equal(touchApiEndpoint(),"https://quizdip.com/api/party");
 assert.equal(touchApiEndpoint("?touchApi="+encodeURIComponent(dev)),dev);
 assert.equal(touchApiEndpoint("?touchApi="+encodeURIComponent("https://evil.example/api/touch")),
   "https://quizdip.com/api/party");
 assert.equal(touchApiEndpoint("?touchApi="+encodeURIComponent(dev+"?admin=1")),
   "https://quizdip.com/api/party");
});
test("offline answer grading uses downloaded canonical answer and cannot double-award",()=>{
 const game=freshGame();setQuestions(game,realQuestions);register(game,2);begin(game,0);
 submit(game,2,2,1000);
 assert.equal(game.players[0].score,0);
 assert.equal(reveal(game),true);
 assert.equal(game.players[0].correct,1);
 const prior=game.players[0].score;
 assert.ok(prior>0);
 assert.equal(reveal(game),false);
 assert.equal(game.players[0].score,prior);
});
test("offline grading is stable across accent, whitespace and case differences",()=>{
 const game=freshGame(),questions=realQuestions.map(q=>({
  ...q,options:["One","Two","  thReE  ","Four"],
  answer:{canonical:"THREE",aliases:[],responseMode:"multiple-choice"}
 }));
 setQuestions(game,questions);register(game,1);begin(game,0);
 submit(game,1,2,1000);assert.equal(reveal(game),true);
 assert.equal(game.players[0].correct,1);
});


test("all A/B/C/D choices need only a small sideways palm move, never a lowered finger",()=>{
 let state=null,result;
 for(let t=0;t<=CALIBRATION_MS+60;t+=60){
  result=horizontalControl(state,{id:1,count:1,palmX:.50,palmY:.85},t);
  state=result.state;
 }
 assert.equal(result.ready,true);
 assert.equal(result.choice,null,"neutral position is deliberately unarmed");
 const positions=[
  {dx:-.135,option:0,position:.125},
  {dx:-.045,option:1,position:.375},
  {dx:.045,option:2,position:.625},
  {dx:.135,option:3,position:.875}
 ];
 for(const entry of positions){
  const moved=horizontalControl(state,{id:1,count:1,palmX:.5+entry.dx,palmY:.88},1200);
  assert.equal(moved.choice,entry.option,"horizontal choice "+entry.option);
  assert.ok(Math.abs(moved.position-entry.position)<.001);
  // Player may keep an upright finger and NEVER move vertically.
  const higher=horizontalControl(state,{id:1,count:1,palmX:.5+entry.dx,palmY:.15},1250);
  assert.equal(higher.choice,entry.option);
 }
 assert.equal(horizontalControl(state,{id:1,count:1,palmX:.5+NEUTRAL_DEAD_ZONE/2},1300).choice,null);
});
test("changing the question, text or media cannot shift a stationary player's pointer",()=>{
 let state=null;
 for(let ms=0;ms<=480;ms+=80){
  state=horizontalControl(state,{id:2,count:2,palmX:.58},ms).state;
 }
 const first=horizontalControl(state,{id:2,count:2,palmX:.625},550);
 const second=horizontalControl(first.state,{id:2,count:2,palmX:.625},15550);
 assert.equal(first.choice,2);
 assert.equal(first.position,second.position);
 assert.equal(first.state.anchor,second.state.anchor);
 assert.equal(second.ready,true,"calibration is never repeated per question");
});
test("invalid or missing hand never chooses, different players have independent centers",()=>{
 let one=null,two=null;
 for(let at=0;at<=480;at+=80){
  one=horizontalControl(one,{id:1,count:1,palmX:.22},at).state;
  two=horizontalControl(two,{id:2,count:2,palmX:.79},at).state;
 }
 assert.equal(horizontalControl(one,{id:1,count:1,palmX:.265},600).choice,2);
 assert.equal(horizontalControl(two,{id:2,count:2,palmX:.835},600).choice,2);
 assert.equal(horizontalControl(one,{id:1,count:0,palmX:.265},700).choice,null);
 assert.equal(horizontalControl(one,null,700).choice,null);
 assert.equal(horizontalControl(null,{id:1,count:1,palmX:.22},700).ready,false);
});
test("answer numbers 1-4 occupy the same fixed 2-by-2 tile positions",()=>{
 const boxes=[
  {left:30,right:750,top:330,bottom:515}, // 1 upper-left
  {left:764,right:1503,top:330,bottom:515}, // 2 upper-right
  {left:30,right:750,top:529,bottom:714}, // 3 lower-left
  {left:764,right:1503,top:529,bottom:714} // 4 lower-right
 ];
 for(let choice=0;choice<4;choice++){
  const centerX=(boxes[choice].left+boxes[choice].right)/2;
  const centerY=(boxes[choice].top+boxes[choice].bottom)/2;
  assert.equal(answerAtPosition(centerX,centerY,boxes),choice);
 }
});
test("quiz layout fixes four choices to a stable 2-by-2 grid",()=>{
 const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
 const section=css.slice(css.lastIndexOf("/* Hand-friendly PARTY BOARD v3"));
 assert.match(section,/\.stage\.playing-stage \.question-zone\s*\{[^}]*grid-template-rows:auto minmax\(0,1fr\) clamp\(/s);
 assert.match(section,/\.stage\.playing-stage \.choices\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[^}]*grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/s);
 assert.match(section,/\.stage\.playing-stage \.touch-question\s*\{[^}]*overflow-y:auto/s);
 assert.doesNotMatch(section,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});
test("players enrolled close to left/right camera edges can reach all four lanes",()=>{
 for(const center of [.11,.89]){
  let state=null;
  for(let t=0;t<=480;t+=80){
   state=horizontalControl(state,{id:1,count:1,palmX:center},t).state;
  }
  const low=center<.5?Math.max(.045,center-.025):.18;
  const high=center>.5?Math.max(.045,.975-center):.18;
  const samples=[
   {dx:-low*.75,choice:0},
   {dx:-low*.25,choice:1},
   {dx:high*.25,choice:2},
   {dx:high*.75,choice:3}
  ];
  for(const sample of samples){
   const input=center+sample.dx;
   assert.ok(input>0&&input<1);
   assert.equal(horizontalControl(state,{id:1,count:1,palmX:input},1000).choice,sample.choice,
    "camera edge "+center+" should still reach lane "+sample.choice);
  }
 }
});
