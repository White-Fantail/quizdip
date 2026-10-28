import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sameRoundView} from "../src/round-view.js";
import {freshGame,setQuestions,register,begin,submit,reveal,advance,TOUCH_COUNT} from "../src/game.js";

const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
const question=i=>({
 id:"q"+i,prompt:"Question "+i,options:["One","Two","Three","Four"],
 answer:{canonical:"Two"}
});

test("answer reveal reuses the exact question, choice, timer and media identity",()=>{
 const game=freshGame();
 register(game,1);
 setQuestions(game,Array.from({length:TOUCH_COUNT},(_,i)=>question(i)));
 begin(game,100);
 const before={game,round:game.round,question:game.questions[game.round],locale:"ko"};
 const nodes={top:{},choice:{},clock:{},media:{}};
 assert.equal(submit(game,1,1,200),true);
 assert.equal(reveal(game),true);
 const after={game,round:game.round,question:game.questions[game.round],locale:"ko"};
 assert.equal(sameRoundView(before,after),true);
 assert.deepEqual(nodes,{top:nodes.top,choice:nodes.choice,clock:nodes.clock,media:nodes.media});
 advance(game,4000);
 assert.equal(sameRoundView(before,{game,round:game.round,question:game.questions[game.round],locale:"ko"}),false);
});
test("new game, new question or language must rebuild the board",()=>{
 const game=freshGame(),a={game,question:{id:"a"},round:0,locale:"ko"};
 assert.equal(sameRoundView(a,{...a,locale:"en"}),false);
 assert.equal(sameRoundView(a,{...a,round:1}),false);
 assert.equal(sameRoundView(a,{...a,question:{id:"a"}}),false);
 assert.equal(sameRoundView(a,{...a,game:freshGame()}),false);
 assert.equal(sameRoundView(null,a),false);
});
test("main render skips destructive innerHTML on same-round reveal",()=>{
 const branch=main.slice(main.indexOf("function render(force=false){"),main.indexOf("function updateStatusFocus("));
 const condition=branch.indexOf("sameRoundView(roundView,nextRound)");
 const teardown=branch.indexOf("choiceMarkers.clear()");
 const rebuild=branch.indexOf("top.innerHTML=");
 assert.ok(condition>0&&condition<teardown&&teardown<rebuild);
 assert.match(branch,/if\(nextRound&&sameRoundView\(roundView,nextRound\)&&top.querySelector\("\.choices"\)\)\{/);
 assert.match(branch,/updateVotes\(\);\s*refreshChoiceMarkers\(\);\s*updateHeader\(\);updateScores\(\);updateStatusFocus\(performance.now\(\)\);\s*return;/);
 assert.match(main,/node.classList.toggle\("correct",revealed&&choice===game.correctIndex\)/);
 assert.match(main,/node.classList.toggle\("wrong",revealed&&choice!==game.correctIndex&&voted.length>0\)/);
});
test("correct-answer message cannot take screen space or resize score row",()=>{
 assert.match(css,/\.app\.play-session \.stage.playing-stage #messages\{[\s\S]*?position:absolute;width:1px;height:1px;overflow:hidden/);
 assert.match(css,/\.app\.play-session \.stage.playing-stage \.bottom-zone>div:last-child\{[\s\S]*?min-height:0;min-width:0;height:100%;overflow:hidden/);
});
