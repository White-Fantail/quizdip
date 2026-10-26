import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
const immersive=css.slice(css.lastIndexOf("/* Active rounds are a game surface"));
const clock=css.slice(css.lastIndexOf("/* PARTY BOARD v4: four"),css.lastIndexOf("/* PARTY BOARD v4: never"));
const fit=css.slice(css.lastIndexOf("/* PARTY BOARD v4: never"));

test("game-only mode hides website chrome while lobby and results retain it",()=>{
 assert.match(main,/classList\.toggle\("play-session",game\.phase==="playing"\|\|game\.phase==="revealed"\)/);
 assert.match(immersive,/\.app\.play-session \.topline,/);
 assert.match(immersive,/\.app\.play-session \.foot\{display:none\}/);
 assert.match(immersive,/\.app\.play-session \.stage\.playing-stage \.question-source\{display:none\}/);
 assert.match(main,/id="answerCount"/);
 assert.match(main,/id="statusFocus"/);
 assert.match(main,/class="scoreboard"/);
});
test("four options occupy stable 2x2 cells while timer has its own center column",()=>{
 assert.match(clock,/grid-template-columns:minmax\(0,1fr\) clamp\(158px,12vw,205px\) minmax\(0,1fr\)/);
 assert.match(clock,/\.choice:nth-child\(1\)\{grid-column:1;grid-row:1\}/);
 assert.match(clock,/\.choice:nth-child\(2\)\{grid-column:3;grid-row:1\}/);
 assert.match(clock,/\.choice:nth-child\(3\)\{grid-column:1;grid-row:2\}/);
 assert.match(clock,/\.choice:nth-child\(4\)\{grid-column:3;grid-row:2\}/);
 assert.match(clock,/\.choices \.status-focus\{[\s\S]*?position:relative;left:auto;top:auto;transform:none/);
 assert.match(clock,/grid-column:2;grid-row:1 \/ span 2/);
 assert.doesNotMatch(clock,/position:absolute/);
});
test("small screens reserve a separate center ROW for the clock",()=>{
 assert.match(clock,/@media\(max-width:780px\)/);
 assert.match(clock,/grid-template-rows:minmax\(134px,1fr\) minmax\(106px,auto\) minmax\(134px,1fr\)/);
 assert.match(clock,/grid-column:1 \/ -1;grid-row:2/);
 assert.match(clock,/\.choice:nth-child\(3\)\{grid-column:1;grid-row:3\}/);
 assert.match(clock,/\.choice:nth-child\(4\)\{grid-column:2;grid-row:3\}/);
});
test("short browsers scroll instead of cutting off bottom options and scores",()=>{
 assert.match(fit,/height:auto;min-height:100dvh;overflow:visible/);
 assert.match(fit,/grid-template-rows:minmax\(505px,1fr\) clamp\(112px,17dvh,160px\)/);
 assert.match(fit,/@media\(max-width:780px\)/);
 assert.match(fit,/grid-template-rows:minmax\(645px,1fr\) clamp\(110px,17dvh,155px\)/);
 assert.match(fit,/@media\(max-height:700px\) and \(min-width:781px\)/);
 assert.doesNotMatch(fit,/overflow:hidden/);
});
