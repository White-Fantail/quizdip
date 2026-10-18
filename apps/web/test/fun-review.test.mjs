import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { funRubric,evaluatePackFun } from "../src/modules/platform/fun-review.ts";
import { platformCatalog } from "../src/modules/platform/catalog.ts";
import { parseOperation,operations } from "../src/modules/platform/contracts.ts";

const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const question=(id,prompt,explanation="",options=["A","B","C","D"])=>({
  id,prompt,title:prompt,explanation,loaded:true,
  answer:{responseMode:"multiple-choice",options},clues:[]
});
const pack=(overrides={})=>({
  id,title:"Culture trip",description:"Discover surprising travel customs",locale:"en",
  orderMode:"CREATOR",sections:[],closingMessage:"Great journey!",scoreReviews:[],
  questions:[question("q1","Why does this happen?","A real, sourced historical note."),
    question("q2","How do locals respond?","Context and an example.")],
  ...overrides
});

test("fun rubric always sums to 100 and is shared with MCP catalog",()=>{
  assert.equal(funRubric.criteria.reduce((s,c)=>s+c.maxPoints,0),100);
  assert.equal(platformCatalog.funQuality,funRubric);
  assert.equal(funRubric.automaticScore,null);
  assert.equal(funRubric.publicationBlocking,false);
  assert.match(operations.quiz_create.description,/funQuality/);
  assert.match(operations.pack_create.description,/funQuality/);
  assert.match(operations.pack_update.description,/funQuality/);
});

test("auto-fun review flags actionable observations but never fabricates scores",()=>{
  const result=evaluatePackFun(pack({
    description:"",closingMessage:"",
    questions:[question("q1","Which animal?", "",["Cat","Dog"]),
      question("q2","Which animal?","")],
  }));
  assert.equal(result.score,null);
  assert.equal(result.blocksPublication,false);
  assert.equal(result.evidence.duplicatedPromptPositions[0],2);
  assert.ok(result.suggestions.some(s=>s.code==="missing_introduction"));
  assert.ok(result.suggestions.some(s=>s.code==="limited_explanations"));
  assert.ok(result.suggestions.some(s=>s.code==="few_distractors"));
  assert.ok(result.suggestions.some(s=>s.code==="duplicate_prompts"));
  assert.ok(result.suggestions.some(s=>s.code==="missing_ending"));
  assert.ok(result.suggestions.every(s=>funRubric.criteria.some(c=>c.id===s.criterionId)));
});

test("quality hints do not penalize text-answer clues, no-clue MC, or voluntary omission of chapters",()=>{
 const result=evaluatePackFun(pack({questions:[{id:"1",prompt:"What am I?",loaded:true,
  answer:{canonical:"tree",responseMode:"text"},clues:[{type:"text",text:"Has leaves"}],explanation:"Interesting botany."}]}));
 assert.equal(result.evidence.mcQuestions,0);
 assert.equal(result.evidence.noClueQuestions,0);
 assert.ok(!result.suggestions.some(s=>s.code==="few_distractors"||s.code==="random_chapters"));
});

test("REST and MCP expose the same authorized non-mutating pack_fun_review operation",()=>{
 const op=parseOperation("pack_fun_review",{id});
 assert.equal(op.id,id);
 assert.equal(operations.pack_fun_review.public,false);
 assert.throws(()=>parseOperation("pack_fun_review",{id:"bogus"}));
 const route=readFileSync(new URL("../app/api/v1/[...segments]/route.ts",import.meta.url),"utf8");
 const mcp=readFileSync(new URL("../app/api/mcp/route.ts",import.meta.url),"utf8");
 const service=readFileSync(new URL("../src/modules/platform/social.ts",import.meta.url),"utf8");
 const dispatch=readFileSync(new URL("../src/modules/platform/operations.ts",import.meta.url),"utf8");
 assert.match(route,/op:"pack_fun_review"/);
 assert.match(dispatch,/case "pack_fun_review": return packFunReview/);
 assert.match(service,/id:p.id,authorId:owner.id/);
 assert.match(service,/funReview:await packFunReview/g);
 assert.match(mcp,/Object.keys\(operations\)/);
});
