import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("pack details show translation status instead of full translation inputs",()=>{
  const detail=read("app/(creator)/studio/packs/pack-detail.tsx");
  const summary=read("app/(creator)/studio/packs/pack-translation-summary.tsx");
  assert.match(detail,/<PackTranslationSummary/);
  assert.doesNotMatch(detail,/<PackTranslationEditor/);
  assert.match(summary,/pack-translation-summary-row/);
  assert.match(summary,/coverage\.find/);
  assert.match(summary,/className="placeholder-panel pack-translation-summary"/);
});

test("translations have a dedicated authenticated route and grouped source/target fields",()=>{
  const route=read("app/(creator)/studio/packs/[packId]/translations/page.tsx");
  const editor=read("app/(creator)/studio/packs/pack-translation-editor.tsx");
  const css=read("app/management.css");
  assert.match(route,/auth\.api\.getSession/);
  assert.match(route,/<PackTranslationEditor packId=\{packId\}\/>/);
  assert.match(editor,/pack-translation-columns/);
  assert.match(editor,/pack-translation-original/);
  assert.match(editor,/<Entry key=\{part\.start\}/);
  assert.match(editor,/<Entry key=\{band\.minimumScore\}/);
  assert.doesNotMatch(editor,/studio-form-grid/);
  assert.match(editor,/beforeunload/);
  assert.match(editor,/missing>0/);
  assert.match(editor,/!complete/);
  assert.match(editor,/role="progressbar"/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.pack-translation-columns\{grid-template-columns:minmax\(0,1fr\)/);
});

test("pack translation editing keeps API contract fields and publication confirmation",()=>{
  const editor=read("app/(creator)/studio/packs/pack-translation-editor.tsx");
  for(const item of ["sections","closingMessage","scoreReviews","minimumScore","start","confirm:status==="+"\"PUBLISHED\""]){
    assert.ok(editor.includes(item),item);
  }
  assert.match(editor,/request\("\/packs\/"\+encodeURIComponent\(packId\)\+"\/languages\/"\+target,"PUT"/);
});
