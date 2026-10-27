import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const immersive=css.slice(css.lastIndexOf("/* The game board is measured"),css.lastIndexOf("/* Live recognition lobby:"));
const compact=immersive.slice(immersive.indexOf("/* A phone rotated into landscape"));

test("game-only mode hides website chrome and keeps the complete round",()=>{
 assert.match(main,/classList\.toggle\("play-session",game\.phase==="playing"\|\|game\.phase==="revealed"\)/);
 assert.match(immersive,/\.app\.play-session \.topline,/);
 assert.match(immersive,/\.app\.play-session \.foot\{display:none\}/);
 assert.match(immersive,/\.app\.play-session \.stage\.playing-stage \.question-source\{display:none\}/);
 for(const id of ["answerCount","statusFocus","scores"])
  assert.match(main,new RegExp(id));
});
test("visible viewport tracks Safari toolbar and orientation changes",()=>{
 assert.match(html,/viewport-fit=cover/);
 assert.match(main,/window\.visualViewport\?\.height\?\?window\.innerHeight/);
 assert.match(main,/visualViewport\?\.addEventListener\("resize",syncVisibleViewport\)/);
 assert.match(main,/addEventListener\("orientationchange",syncVisibleViewport\)/);
 assert.match(immersive,/height:var\(--party-visible-height,100dvh\);min-height:0/);
 assert.match(immersive,/safe-area-inset-left/);
});
test("no fixed-height floor pushes answers below short viewports",()=>{
 assert.doesNotMatch(immersive,/min-height:\s*(?:[5-9]\d\d|\d{4,})px/);
 assert.doesNotMatch(immersive,/min-height:max\(/);
 assert.match(immersive,/grid-template-rows:minmax\(0,1fr\) clamp\(44px,15dvh,64px\)/);
 assert.match(immersive,/\.touch-question\{[\s\S]*?overflow-y:auto/);
});
test("answers 1–4 and clock each have separate non-overlapping grid slots",()=>{
 for(const [n,col,row] of [[1,1,1],[2,3,1],[3,1,2],[4,3,2]])
  assert.match(immersive,new RegExp(`\\.choice:nth-child\\(${n}\\)\\{grid-column:${col};grid-row:${row}\\}`));
 assert.match(immersive,/grid-column:2;grid-row:1 \/ span 2/);
 assert.match(immersive,/position:relative;left:auto;top:auto;transform:none/);
});
test("portrait keeps a center clock row, short landscape restores 3 columns",()=>{
 assert.match(immersive,/@media\(max-width:780px\) and \(orientation:portrait\)/);
 assert.match(immersive,/grid-column:1 \/ -1;grid-row:2/);
 assert.match(compact,/@media\(orientation:landscape\) and \(max-height:640px\)/);
 assert.match(compact,/grid-template-columns:minmax\(0,1fr\) clamp\(66px,10vw,100px\) minmax\(0,1fr\)/);
 assert.match(compact,/\.scoreboard \.player\{[\s\S]*?display:grid/);
 assert.match(compact,/status-focus__headline,[\s\S]*?display:none/);
});
