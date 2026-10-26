import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {roundFocusState} from "../src/round-focus.js";

const f=(overrides={})=>roundFocusState({
 phase:"playing",remainingMs:30000,totalMs:30000,...overrides
});
const read=(name)=>readFileSync(new URL(name,import.meta.url),"utf8");

test("countdown starts immediately, with no open-palm requirement during thinking",()=>{
 assert.equal(f().mode,"timer");
 assert.equal(f().seconds,30);
 assert.equal(f().progress,1);
 assert.equal(f({readyCount:0,playerCount:5,allReadyAt:null}).mode,"timer");
 assert.equal(f({readyCount:5,playerCount:5,allReadyAt:0}).mode,"timer");
 assert.equal(f({remainingMs:9000}).seconds,9);
});
test("deadline warnings stay visible independently of hand poses",()=>{
 assert.equal(f({remainingMs:5000}).mode,"warning");
 assert.equal(f({remainingMs:5001}).mode,"timer");
 assert.equal(f({remainingMs:3000}).mode,"critical");
 assert.equal(f({remainingMs:1}).mode,"critical");
 assert.equal(f({remainingMs:0}).seconds,0);
 assert.equal(f({remainingMs:-500}).progress,0);
 assert.equal(f({remainingMs:90000}).progress,1);
 assert.equal(f({phase:"revealed",remainingMs:1000}).mode,"revealed");
});
test("fixed four-choice layout, accessible status, and always-on center clock",()=>{
 const main=read("../src/main.js");
 const css=read("../src/style.css");
 assert.match(main,/id="statusFocus"/);
 assert.match(main,/id="focusAnnouncer"/);
 assert.match(main,/aria-live="polite"/);
 assert.doesNotMatch(main,/readyPlayers|allReadyAt/);
 assert.doesNotMatch(main,/손바닥을 펴세요!|Show five fingers!/);
 assert.match(main,/주먹을 쥐고 생각하다가 1~4개로 선택/);
 assert.match(main,/roundFocusState\(\{/);
 assert.doesNotMatch(main,/id="countdown"/);
 assert.match(css,/\.stage\.playing-stage \.choices\{position:relative;isolation:isolate\}/);
 assert.match(css,/\.status-focus\{[^}]*position:absolute/s);
 assert.match(css,/\.status-focus\[data-mode="critical"\]/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("central timer stays between 2x2 choices on narrow screens",()=>{
 const css=read("../src/style.css");
 const main=read("../src/main.js");
 const section=css.slice(css.lastIndexOf("/* Hand-friendly PARTY BOARD v3"));
 assert.match(section,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(section,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.status-focus\{[^}]*left:50%;top:50%/s);
 assert.match(css,/@media\(max-width:780px\)\{[\s\S]*?\.stage\.playing-stage \.choices \.status-focus\{[\s\S]*?left:50%;top:50%;transform:translate\(-50%,-50%\)/);
 assert.match(css,/\.choices \.choice:nth-child\(odd\)/);
 assert.match(css,/\.choices \.choice:nth-child\(even\)/);
 assert.doesNotMatch(css,/top:5px;transform:translate\(-50%,0\)/);
 assert.match(main,/answers\.map\(\(answer,i\)=>/);
});
