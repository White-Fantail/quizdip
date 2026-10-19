import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("pack runs pin their own version instead of reading the latest version on results",()=>{
  const runs=read("src/modules/platform/runs.ts");
  const schema=read("../../prisma/schema.prisma");
  assert.match(schema,/packVersion Int\?/);
  assert.match(runs,/packVersion:pack\.currentVersion,targetCount:ids\.length/);
  assert.match(runs,/packVersion:run\.packVersion\?\?null/);
  assert.match(runs,/packVersion:run\.packVersion,currentPackVersion:pack\.packVersion/);
  assert.match(runs,/run\.packVersion===pack\.packVersion/);
  assert.match(runs,/run\.scoringVersion===2/);
  assert.match(runs,/runId:run\.id\},select:\{quizId:true,revisionId:true\}/);
  assert.match(runs,/pinned\.every\(item=>revisions\.has/);
});

test("published question edits and translations advance versions for containing packs",()=>{
  const quiz=read("src/modules/platform/quiz.ts");
  const translations=read("src/modules/platform/translations.ts");
  const social=read("src/modules/platform/social.ts");
  assert.match(quiz,/old\.publication === "PUBLISHED"\) await tx\.quizPack\.updateMany/);
  assert.match(quiz,/items:\{some:\{quizId:old\.id\}\}/);
  assert.match(translations,/items:\{some:\{quizId:quiz\.id\}\}/);
  assert.match(social,/pack\.publication==="PUBLISHED"&&\(previous\?\.status==="PUBLISHED"/);
  assert.match(social,/currentVersion:\{increment:1\}/);
  const baseline=read("../../prisma/migrations/20261020112000_pack_score_version_baseline/migration.sql");
  assert.match(baseline,/UPDATE "QuizPack"/);
  assert.match(baseline,/WHERE "publication" = 'PUBLISHED'/);
  assert.doesNotMatch(baseline,/UPDATE "PlayRun"/);
});

test("play, history, cards, and public shared results show the pinned version",()=>{
  const play=read("app/(platform)/play/page.tsx");
  const history=read("app/account/results/page.tsx");
  const card=read("src/components/pack-result-share.tsx");
  const shared=read("app/(platform)/results/[shareId]/page.tsx");
  const og=read("src/modules/platform/result-og-image.tsx");
  for(const source of [play,history,card,shared,og])assert.match(source,/packVersion/);
  assert.match(play,/packVersion=\{run\.packVersion\}/);
  assert.match(history,/packVersion=\{run\.packVersion\}/);
  assert.match(shared,/!result\.comparable/);
  assert.match(shared,/currentPackVersion!==result\.packVersion/);
  assert.match(card,/same version only/);
  assert.match(og,/same version/);
});
