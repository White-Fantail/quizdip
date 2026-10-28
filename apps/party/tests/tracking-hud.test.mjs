import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {trackingHudState,LOST_PREVIEW_MS} from "../src/tracking-hud.js";
import {ZoneHandTracker} from "../src/zone-tracker.js";

const zones=[{id:1,center:.25,left:0,right:.5},{id:2,center:.75,left:.5,right:1}];

test("camera map preserves position through loss, then hides recovery after reacquisition",()=>{
 let state=trackingHudState(null,zones,[{id:1,x:.21,y:.43},{id:2,x:.73,y:.62}],0);
 assert.deepEqual(state.players.map(p=>p.online),[true,true]);
 state=trackingHudState(state,zones,[{id:1,x:.25,y:.46}],100);
 assert.equal(state.players[1].missingSince,100);
 assert.equal(state.players[1].lost,false);
 assert.deepEqual([state.players[1].x,state.players[1].y],[.73,.62]);
 state=trackingHudState(state,zones,[{id:1,x:.25,y:.46}],100+LOST_PREVIEW_MS);
 assert.deepEqual(state.players.map(p=>p.lost),[false,true]);
 state=trackingHudState(state,zones,[{id:1,x:.26,y:.46},{id:2,x:.72,y:.58}],1200);
 assert.deepEqual(state.players.map(p=>p.lost),[false,false]);
 assert.deepEqual(state.players.map(p=>p.missingSince),[null,null]);
});

test("unknown hands remain anonymous and do not create fake player badges",()=>{
 const state=trackingHudState(null,zones,[{id:null,x:.80,y:.34},{id:999,x:1.2,y:-.2}],10);
 assert.equal(state.players.every(p=>!p.online),true);
 assert.deepEqual(state.unknown,[{x:.8,y:.34},{x:1,y:0}]);
 assert.equal(state.players[0].x,.25);
 assert.equal(state.players[1].x,.75);
});

test("tracking snapshot never labels unverified, crossed, or fresh hands",()=>{
 const tracker=new ZoneHandTracker();
 tracker.zones=zones.map(z=>({...z}));
 tracker.current=[{rawId:10,palm:{x:.2,y:.4}},{rawId:11,palm:{x:.7,y:.7}}];
 tracker.assigned=[{id:1,x:.2,y:.4}];
 assert.deepEqual(tracker.getTrackingSnapshot().hands,[
  {id:1,x:.2,y:.4},{id:null,x:.7,y:.7}
 ]);
});

test("live minimap sits beside scores in the existing gameplay row without moving answers",()=>{
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
 assert.match(main,/tracker\.getTrackingSnapshot\(\)/);
 assert.match(main,/trackingHudState\(trackingState,snapshot\.zones/);
 assert.match(main,/trackingMap/);
 assert.match(main,/box\.classList\.toggle\("is-recovering",recovering\)/);
 assert.match(main,/video\.videoWidth\/video\.videoHeight/);
 assert.match(css,/\.app\.play-session \.stage\.playing-stage \.bottom-zone\{[\s\S]*?grid-template-columns:clamp\(82px,13vw,150px\) minmax\(0,1fr\)/);
 assert.match(css,/\.camera-box\.is-recovering video\{opacity:\.85\}/);
 assert.match(css,/\.tracking-map__scene/);
 assert.match(css,/object-fit:contain/);
});
