import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {touchApiEndpoint} from "../src/source.js";
const read=(name)=>readFileSync(new URL(name,import.meta.url),"utf8");
test("Party name appears in page title and game interface",()=>{
 assert.ok(read("../index.html").includes("QuizDip Party"));
 assert.ok(read("../src/main.js").includes("<span>PARTY</span>"));
 assert.ok(read("../src/main.js").includes("QUIZDIP · PARTY"));
});
test("canonical Party API and allowlisted preview override",()=>{
 assert.equal(touchApiEndpoint(),"https://quizdip.com/api/party");
 const url="https://quizdip-dev-nomadonghos-projects.vercel.app/api/party";
 assert.equal(touchApiEndpoint("?partyApi="+encodeURIComponent(url)),url);
 assert.equal(touchApiEndpoint("?partyApi="+encodeURIComponent("https://evil.example/api/party")),"https://quizdip.com/api/party");
});
