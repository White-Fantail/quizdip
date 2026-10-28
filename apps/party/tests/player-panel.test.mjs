import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {playerPanelState} from "../src/player-panel.js";

const state=(input={})=>playerPanelState({hand:null,answer:null,vote:null,phase:"playing",locale:"ko",...input});

test("submitted answer never replaces live fingers in either phase",()=>{
 for(const phase of ["playing","revealed"]){
  const actual=state({phase,hand:{id:1,count:5},answer:{choice:1}});
  assert.equal(actual.fingers,"5");
  assert.equal(actual.tracking,"손 인식 중");
  assert.equal(actual.selection,"제출 2번 ✓");
  assert.equal(actual.progress,100);
 }
});

test("tracking loss does not erase an already submitted answer",()=>{
 const actual=state({phase:"revealed",answer:{choice:3}});
 assert.equal(actual.fingers,"—");
 assert.equal(actual.tracking,"인식 안 됨");
 assert.equal(actual.selection,"제출 4번 ✓");
 assert.equal(actual.progress,100);
 assert.equal(actual.detected,false);
});

test("all 0–5 live finger values stay distinct from the pending selection",()=>{
 for(let n=0;n<=5;n++){
  const actual=state({hand:{id:2,count:n}});
  assert.equal(actual.fingers,String(n));
  assert.equal(actual.selection,"미제출");
 }
 assert.equal(state({hand:{count:9}}).fingers,"—");
 assert.equal(state({hand:{count:2.5}}).detected,false);
});

test("countdown stays visible before a vote and never leaks into reveal",()=>{
 const arming=state({hand:{count:2},vote:{phase:"arming",choice:1}});
 assert.equal(arming.selection,"선택 2 확인 중");
 const counting=state({hand:{count:2},vote:{phase:"countdown",choice:1,progress:.65,remainingMs:350}});
 assert.equal(counting.selection,"선택 2 · 0.3s");
 assert.equal(counting.progress,65);
 const revealed=state({phase:"revealed",hand:{count:1},vote:{phase:"countdown",choice:1}});
 assert.equal(revealed.selection,"미제출");
 assert.equal(revealed.progress,0);
});

test("English locale follows the same independent display model",()=>{
 const actual=state({locale:"en",hand:{count:0},answer:{choice:0}});
 assert.equal(actual.fingers,"0");
 assert.equal(actual.tracking,"Hand tracked");
 assert.equal(actual.selection,"Voted 1 ✓");
});

test("round DOM keeps tracking, finger count and answer in fixed slots",()=>{
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
 assert.match(main,/playerPanelState\(\{hand,answer,vote,phase:game.phase,locale\}\)/);
 for(const token of ["player-tracking","player-gesture","player-submission"])
  assert.match(main,new RegExp(token));
 assert.doesNotMatch(main,/const count=answer\?String\(answer.choice\+1\)/);
 assert.match(css,/\.round-player \.player-gesture\{\s*grid-column:2;grid-row:2/);
 assert.match(css,/\.round-player \.player-tracking\{\s*grid-column:1;grid-row:2/);
 assert.match(css,/\.round-player \.player-submission\{\s*grid-column:3;grid-row:2/);
 assert.match(css,/\.round-player \.player-progress\{\s*grid-column:1 \/ -1;grid-row:3/);
});
