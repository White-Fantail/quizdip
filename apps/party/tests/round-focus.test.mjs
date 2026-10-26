import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {roundFocusState,READY_CELEBRATION_MS} from "../src/round-focus.js";

const f=(overrides={})=>roundFocusState({
 phase:"playing",remainingMs:30000,totalMs:30000,playerCount:2,
 readyCount:0,allReadyAt:null,now:1000,...overrides
});
const read=(name)=>readFileSync(new URL(name,import.meta.url),"utf8");

test("unarmed players are explicitly prompted for open palms at the central clock",()=>{
 assert.equal(f().mode,"prepare");
 assert.equal(f({readyCount:1}).mode,"prepare");
 assert.equal(f({readyCount:1}).seconds,30);
 assert.equal(f({readyCount:1}).progress,1);
});
test("everyone ready produces exactly one short, strong round celebration",()=>{
 assert.equal(f({readyCount:2,allReadyAt:1000}).mode,"ready");
 assert.equal(f({readyCount:2,allReadyAt:1000,now:1000+READY_CELEBRATION_MS-1}).mode,"ready");
 assert.equal(f({readyCount:2,allReadyAt:1000,now:1000+READY_CELEBRATION_MS}).mode,"timer");
 assert.equal(f({readyCount:1,allReadyAt:1000}).mode,"prepare");
 assert.equal(f({readyCount:2,allReadyAt:null}).mode,"timer");
});
test("deadline overrides readiness and ring percentage is bounded",()=>{
 assert.equal(f({remainingMs:5000}).mode,"warning");
 assert.equal(f({remainingMs:5001}).mode,"prepare");
 assert.equal(f({remainingMs:3000}).mode,"critical");
 assert.equal(f({remainingMs:1}).mode,"critical");
 assert.equal(f({remainingMs:0}).seconds,0);
 assert.equal(f({remainingMs:-500}).progress,0);
 assert.equal(f({remainingMs:90000}).progress,1);
 assert.equal(f({phase:"revealed",remainingMs:1000}).mode,"revealed");
});
test("fixed four-choice layout, per-round reset, accessible status, and clock only in center",()=>{
 const main=read("../src/main.js");
 const css=read("../src/style.css");
 assert.match(main,/id="statusFocus"/);
 assert.match(main,/id="focusAnnouncer"/);
 assert.match(main,/aria-live="polite"/);
 assert.match(main,/readyPlayers\.clear\(\);allReadyAt=null/);
 assert.match(main,/readyPlayers\.add\(player\.id\)/);
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
 assert.match(section,/grid-template-columns:repeat\\(2,minmax\\(0,1fr\\)\\)/);
 assert.match(section,/grid-template-rows:repeat\\(2,minmax\\(0,1fr\\)\\)/);
 assert.match(css,/\\.status-focus\\{[^}]*left:50%;top:50%/s);
 assert.match(css,/@media\\(max-width:780px\\)\\{[\\s\\S]*?\\.stage\\.playing-stage \\.choices \\.status-focus\\{[\\s\\S]*?left:50%;top:50%;transform:translate\\(-50%,-50%\\)/);
 assert.match(css,/\\.choices \\.choice:nth-child\\(odd\\)/);
 assert.match(css,/\\.choices \\.choice:nth-child\\(even\\)/);
 assert.doesNotMatch(css,/top:5px;transform:translate\\(-50%,0\\)/);
 assert.match(main,/answers\\.map\\(\\(answer,i\\)=>/);
});
