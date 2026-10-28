import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {containedVideoRect,videoRectStyle} from "../src/camera-overlay.js";

test("side letterboxing aligns every palm marker with its actual image coordinate",()=>{
 const r=containedVideoRect(620,270,1280,720);
 assert.deepEqual(r,{left:70,top:0,width:480,height:270});
 assert.equal(r.left+r.width*.7,406);
 assert.equal(videoRectStyle(r),"left:70px;top:0px;width:480px;height:270px");
});
test("portrait video and not-yet-ready camera preserve the correct bounds",()=>{
 const r=containedVideoRect(240,240,1280,720);
 assert.deepEqual(r,{left:0,top:52.5,width:240,height:135});
 assert.equal(r.left+r.width*.75,180);
 assert.equal(containedVideoRect(0,200,1280,720).width,0);
});
test("lobby and in-game map use the same aspect-fit coordinate transform",()=>{
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
 assert.match(main,/tracker\.getCameraDiagnostics\(\)/);
 assert.match(main,/camera-guide-scene/);
 assert.ok(main.split("containedVideoRect(box.clientWidth,box.clientHeight,video.videoWidth,video.videoHeight)").length>=3);
 assert.match(css,/\.camera-guide-scene/);
 assert.match(css,/\.camera-finger-tip/);
});
