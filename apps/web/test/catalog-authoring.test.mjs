import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platformCatalog } from "../src/modules/platform/catalog.ts";
import { parseOperation, operations } from "../src/modules/platform/contracts.ts";

const uuid="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const basicAnswer={canonical:"2003",responseMode:"multiple-choice",options:["2003","2002"]};

test("catalog accurately advertises zero-clue MC, legacy clue rules and current image reveal effects",()=>{
  assert.equal(platformCatalog.minClues,0);
  assert.deepEqual(platformCatalog.minCluesByResponseMode,{text:1,"multiple-choice":0});
  assert.equal(platformCatalog.multipleChoice.zeroClueCorrectScore,75);
  assert.deepEqual(platformCatalog.imageRevealEffects,["zoom","spotlight"]);
  assert.ok(!platformCatalog.imageRevealEffects.includes("blur"));
  assert.deepEqual(parseOperation("quiz_create",{title:"Year",prompt:"What year?",answer:basicAnswer,clues:[]}).clues,[]);
  assert.throws(()=>parseOperation("quiz_create",{title:"Year",prompt:"What year?",answer:{canonical:"2003"},clues:[]}));
});

test("catalog advertises precisely the authorable pack chapter, cover, closing and score fields",()=>{
  const info=platformCatalog.packAuthoring;
  assert.equal(info.maxQuestions,100);
  assert.equal(info.sections.maxSections,30);
  assert.equal(info.sections.firstStart,1);
  assert.equal(info.sections.requiresOrderMode,"CREATOR");
  assert.equal(info.sections.dedicatedTransitionScreen,true);
  assert.equal(info.sections.countedAsQuestion,false);
  assert.equal(info.closingMessage.maxLength,4000);
  assert.equal(info.scoreReviews.thresholdUnit,"total_points_not_percentage");
  const parsed=parseOperation("pack_create",{
    title:"History",quizIds:[uuid],orderMode:"CREATOR",coverMediaId:uuid,
    sections:[{start:1,title:"Early life",description:"Part introduction",mediaId:uuid}],
    closingMessage:"From the creator",
    scoreReviews:[{minimumScore:0,title:"Thank you"}],
  });
  assert.equal(parsed.coverMediaId,uuid);
  assert.equal(parsed.sections[0].mediaId,uuid);
  assert.equal(parsed.closingMessage,"From the creator");
  assert.equal(parsed.scoreReviews[0].minimumScore,0);
  assert.deepEqual(platformCatalog.packAuthoring.supportedOperations,["pack_create","pack_update"]);
  assert.ok(operations.pack_create.description.includes("chapter"));
  assert.ok(operations.pack_update.description.includes("sections"));
});

test("MCP server exposes the exact shared contracts and catalog implementation",()=>{
  const operationsSource=readFileSync(new URL("../src/modules/platform/operations.ts",import.meta.url),"utf8");
  const route=readFileSync(new URL("../app/api/mcp/route.ts",import.meta.url),"utf8");
  assert.match(operationsSource,/case "catalog": return platformCatalog/);
  assert.match(route,/inputSchema: spec\.schema/);
  assert.ok(operations.quiz_create.description.includes("zero clues"));
  assert.ok(operations.quiz_update.description.includes("explanation"));
  assert.equal(platformCatalog.quizAuthoring.explanation.maxLength,4000);
  assert.equal(parseOperation("quiz_update",{id:uuid,expectedVersion:1,explanation:"Context"}).explanation,"Context");
});

test("catalog and MCP contracts advertise all independently translated pack fields",()=>{
  const info=platformCatalog.packLocalization;
  assert.equal(platformCatalog.version,"v3");
  assert.equal(platformCatalog.catalogRevision,"2026-10-18-pack-full-localizations");
  assert.deepEqual(info.supportedLocales,["en","ko"]);
  assert.deepEqual(info.supportedOperations,["pack_languages","pack_translation_upsert"]);
  assert.deepEqual(info.fields.sections.fields,["start","title","description"]);
  assert.equal(info.fields.sections.acceptsMediaId,false);
  assert.equal(info.fields.sections.matchesOriginalStartPositions,true);
  assert.equal(info.fields.closingMessage.requiredForPublishingWhenPresentInSource,true);
  assert.deepEqual(info.fields.scoreReviews.fields,["minimumScore","title","description"]);
  assert.equal(info.fields.scoreReviews.originalMinimumScoresPreserved,true);
  assert.equal(info.publication.requiresCompleteQuestionLanguageCoverage,true);
  assert.equal(info.publication.missingLanguageNeverFallsBackToSourceText,true);
  assert.ok(operations.pack_translation_upsert.description.includes("ending"));
  const translated=parseOperation("pack_translation_upsert",{
    id:uuid,locale:"ko",title:"제목",description:"소개",
    sections:[{start:1,title:"첫 번째 파트",description:"내용"}],
    closingMessage:"마무리 인사",
    scoreReviews:[{minimumScore:0,title:"첫걸음",description:"잘했어요"}],
    status:"PUBLISHED",confirm:true
  });
  assert.equal(translated.sections[0].title,"첫 번째 파트");
  assert.equal(translated.closingMessage,"마무리 인사");
  assert.equal(translated.scoreReviews[0].description,"잘했어요");
  assert.throws(()=>parseOperation("pack_translation_upsert",{
    id:uuid,locale:"ko",title:"제목",
    sections:[{start:1,title:"첫 번째 파트",mediaId:uuid}]
  }));
});
