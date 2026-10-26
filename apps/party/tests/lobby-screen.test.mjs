import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
const lobby=css.slice(css.lastIndexOf("/* Live recognition lobby:"));

test("compact lobby layout is exclusive to recognized game mode before play",()=>{
 assert.match(main,/classList\.toggle\("lobby-session",game\.phase==="lobby"&&!!selectedLane\)/);
 assert.match(main,/classList\.toggle\("play-session",game\.phase==="playing"\|\|game\.phase==="revealed"\)/);
 assert.match(lobby,/\.app\.lobby-session\{[\s\S]*?height:100dvh;min-height:0;overflow:hidden/);
 assert.match(lobby,/\.app\.lobby-session \.stage\.lobby-stage\{[\s\S]*?justify-content:space-between/);
});

test("video preview is bounded and shows the entire camera image",()=>{
 assert.match(lobby,/\.app\.lobby-session \.stage\.lobby-stage \.bottom-zone\{[\s\S]*?height:clamp\(180px,31dvh,255px\);min-height:0;max-height:255px/);
 assert.match(lobby,/grid-template-columns:minmax\(290px,min\(36vw,470px\)\) minmax\(0,1fr\)/);
 assert.match(lobby,/\.app\.lobby-session \.stage\.lobby-stage \.camera-box\{[\s\S]*?height:100%;min-height:0;max-height:none/);
 assert.match(lobby,/\.camera-box video\{\s*object-fit:contain/);
 assert.doesNotMatch(lobby,/object-fit:cover/);
 assert.match(lobby,/\.app\.lobby-session \.stage\.lobby-stage \.scoreboard\{/);
});

test("readiness and controls stay visible while decorative layout is compacted",()=>{
 assert.match(lobby,/\.app\.lobby-session \.lobby-control \.actions button\{/);
 assert.match(lobby,/\.app\.lobby-session \.lobby-hands-status strong\{/);
 assert.match(lobby,/\.app\.lobby-session \.lobby-hands-track\{/);
 assert.match(main,/id="lobbyHoldText"/);
 assert.match(main,/id="lobbyHoldProgress"/);
 assert.match(main,/id="recognizedCount"/);
 assert.match(main,/id="confirmPlayers"/);
 assert.match(main,/id="changeMode"/);
});

test("short desktop and phone sizes gracefully allow scroll if necessary",()=>{
 assert.match(lobby,/@media\(max-height:625px\) and \(min-width:781px\)/);
 assert.match(lobby,/@media\(max-width:780px\)/);
 assert.match(lobby,/\.app\.lobby-session\{\s*height:auto;min-height:100dvh;overflow:visible/);
 assert.match(lobby,/height:clamp\(180px,31dvh,245px\);min-height:180px/);
});
