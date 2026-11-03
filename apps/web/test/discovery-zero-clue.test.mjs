import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hasPlayableDiscoveryClues} from "../src/modules/platform/discovery-eligibility.ts";

test("zero-clue published multiple-choice questions remain discoverable",()=>{
  assert.equal(hasPlayableDiscoveryClues([],{responseMode:"multiple-choice",options:["A","B"]}),true);
  assert.equal(hasPlayableDiscoveryClues([],{responseMode:"text"}),false);
  assert.equal(hasPlayableDiscoveryClues([],{responseMode:"multiple-choice",options:[]}),false);
  assert.equal(hasPlayableDiscoveryClues([],null),false);
  assert.equal(hasPlayableDiscoveryClues([{type:"text",text:"hint"}],{responseMode:"text"}),true);
  assert.equal(hasPlayableDiscoveryClues(null,{responseMode:"multiple-choice",options:["A","B"]}),false);
});

test("discovery uses zero-clue eligibility without skipping media or safety checks",()=>{
 const code=readFileSync(new URL("../src/modules/platform/discovery.ts",import.meta.url),"utf8");
 assert.match(code,/select:\{id:true,quizId:true,title:true,clues:true,answer:true,promptMediaIds:true\}/);
 assert.match(code,/hasPlayableDiscoveryClues\(rev.clues,rev.answer\)/);
 assert.match(code,/used.some\(id=>!allowedMedia.has\(id\)\)/);
 assert.match(code,/playableQuizWhere\(locale\)/);
 assert.doesNotMatch(code,/!Array.isArray\(rev.clues\)\|\|!rev.clues.length/);
});
