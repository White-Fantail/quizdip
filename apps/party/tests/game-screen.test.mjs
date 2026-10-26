import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
const playStyles=css.slice(css.lastIndexOf("/* Active rounds are a game surface"));

test("only active gameplay/reveal enters immersive layout; lobby and results keep controls",()=>{
 assert.match(main,/classList\.toggle\("play-session",game\.phase==="playing"\|\|game\.phase==="revealed"\)/);
 assert.match(main,/classList\.toggle\("playing-stage",game\.phase==="playing"\|\|game\.phase==="revealed"\)/);
 assert.doesNotMatch(main,/classList\.add\("play-session"\)/);
});
test("game view hides site chrome and irrelevant metadata without hiding score or state",()=>{
 assert.ok(playStyles.includes(".app.play-session .topline,"));
 assert.match(playStyles,/\.app\.play-session \.foot\{display:none\}/);
 assert.match(playStyles,/\.app\.play-session \.stage\.playing-stage \.question-source\{display:none\}/);
 assert.doesNotMatch(playStyles,/\.app\.play-session \.scoreboard\{display:none\}/);
 assert.doesNotMatch(playStyles,/\.app\.play-session \.question-head\{display:none\}/);
 assert.match(main,/id="answerCount"/);
 assert.match(main,/id="statusFocus"/);
 assert.match(main,/class="scoreboard"/);
});
test("fullscreen stage still reserves stable 2 by 2 answers and bottom player status",()=>{
 assert.match(playStyles,/height:100dvh;min-height:0;padding:var\(--play-gutter\)/);
 assert.match(playStyles,/\.app\.play-session \.stage\.playing-stage\{[\s\S]*?grid-template-rows:minmax\(0,1fr\) clamp\(110px,17dvh,165px\)/);
 assert.match(playStyles,/\.app\.play-session \.stage\.playing-stage \.question-zone\{[\s\S]*?grid-template-rows:clamp\(26px,3\.8dvh,34px\) minmax\(0,1fr\) clamp\(280px,50dvh,520px\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(playStyles,/@media\(max-width:780px\)/);
 assert.match(playStyles,/@media\(max-height:640px\) and \(min-width:781px\)/);
});
