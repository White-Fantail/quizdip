import test from "node:test";
import assert from "node:assert/strict";
import {palmPoint,handGesture,nearestTrackMatching,answerAtPosition,screenPoint} from "../src/gestures.js";
import {freshGame,register,begin,submit,reveal,advance,DEMO_QUESTIONS} from "../src/game.js";
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
