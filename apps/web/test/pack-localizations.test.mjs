import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation} from "../src/modules/platform/contracts.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const id="6fefac38-db59-40ec-9b9a-7bc36a42280a";
const sections=[{start:1,title:"억만장자가 되기 전",description:"어린 시절의 이야기"}];
const scoreReviews=[{minimumScore:0,title:"우주 탐험가",description:"한 걸음 더!"}];
const pack={id,locale:"ko",title:"한국어 제목",description:"한국어 소개",
  sections,closingMessage:"도전해 주셔서 고마워요!",scoreReviews,status:"PUBLISHED",confirm:true};

test("pack language upsert supports whole-story translations with required ownership fields",()=>{
  const parsed=parseOperation("pack_translation_upsert",pack);
  assert.deepEqual(parsed.sections,sections);
  assert.deepEqual(parsed.scoreReviews,scoreReviews);
  assert.equal(parsed.closingMessage,pack.closingMessage);
  assert.equal(parsed.status,"PUBLISHED");
  assert.equal(parsed.confirm,true);
  assert.throws(()=>parseOperation("pack_translation_upsert",{...pack,sections:[{...sections[0],mediaId:id}]}),
    /unrecognized|invalid/i,"translation must not accept a replacement media ID");
  assert.throws(()=>parseOperation("pack_translation_upsert",{...pack,sections:[{...sections[0],start:0}]}));
  assert.throws(()=>parseOperation("pack_translation_upsert",{...pack,scoreReviews:[{...scoreReviews[0],minimumScore:-1}]}));
  assert.throws(()=>parseOperation("pack_translation_upsert",{...pack,closingMessage:"x".repeat(4001)}));
});

test("localized pack fields are saved independently and projected onto the original chapter order",()=>{
  const schema=read("../../prisma/schema.prisma");
  const migration=read("../../prisma/migrations/20261018194000_pack_full_localizations/migration.sql");
  const social=read("src/modules/platform/social.ts");
  const editor=read("app/(creator)/studio/packs/pack-translation-editor.tsx");
  const detail=read("app/(creator)/studio/packs/pack-detail.tsx");
  const page=read("app/(platform)/play/page.tsx");
  for(const field of ["sections","closingMessage","scoreReviews"]){
    assert.match(schema,new RegExp(field+"\\s+"));
    assert.match(migration,new RegExp('"'+field+'"'));
    assert.match(social,new RegExp("localized\\."+field));
  }
  assert.match(social,/validateTranslatedPackStructure/);
  assert.match(social,/part\.start===section\.start/);
  assert.match(social,/translated_section_mismatch/);
  assert.match(social,/translated_score_mismatch/);
  assert.match(social,/incomplete_pack_translation/);
  assert.match(social,/mediaId:section\.mediaId/);
  assert.match(social,/pack\.sourceLocale===locale/);
  assert.match(social,/scoreReviews:reviews/);
  assert.match(social,/closingMessage:ending/);
  assert.match(editor,/sections:.*draft/);
  assert.match(detail,/PackTranslationEditor/);
  assert.match(page,/pack\?\.closingMessage/);
  assert.match(page,/chapterIntro/);
  assert.match(migration,/억만장자가 되기 전/);
  assert.match(migration,/지구에서 출발한 탐험가/);
});

test("localized pack text uses existing REST/MCP parity, not a shadow authoring route",()=>{
  const route=read("app/api/v1/[...segments]/route.ts");
  const operations=read("src/modules/platform/operations.ts");
  assert.match(route,/op: "pack_translation_upsert"/);
  assert.match(operations,/case "pack_translation_upsert": return packTranslationUpsert/);
});
