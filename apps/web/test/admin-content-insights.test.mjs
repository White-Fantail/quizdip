import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../prisma/migrations/20261019030000_admin_choice_analytics/migration.sql", import.meta.url), "utf8");

test("choice analytics migration is additive and does not invent historical choices", () => {
  assert.match(schema, /firstChoice\s+String\?/);
  assert.match(migration, /ALTER TABLE "PlaySession" ADD COLUMN "firstChoice" TEXT/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|DROP/i);
});

test("every server-graded authored multiple-choice response captures only the first valid selection atomically", () => {
  const play=src("src/modules/platform/play.ts");
  const options=src("src/modules/platform/answer-options.ts");
  assert.match(play, /session\.firstChoice === null \? firstAuthoredChoice\(answer, p\.guess\)/);
  assert.match(play, /data: \{ wrongGuesses:[\s\S]*?firstChoice/);
  assert.match(options, /answerResponseMode\(value\) !== "multiple-choice"/);
  assert.match(options, /\.options!\.find/);
});

test("local play results sync first choice while repeated syncs preserve completed results", () => {
  const domain=readFileSync(new URL("../../../packages/domain/src/local-play.ts",import.meta.url),"utf8");
  const outbox=src("src/lib/local-run-sync.ts");
  const sync=src("src/modules/platform/local-play.ts");
  const contracts=src("src/modules/platform/contracts.ts");
  const single=src("app/(platform)/play/[quizId]/page.tsx");
  assert.match(domain, /!state\.firstChoice/);
  assert.match(outbox, /progress\.firstChoice/);
  assert.match(sync, /existing\?\.status==="SOLVED"\|\|existing\?\.status==="FAILED"\)continue/);
  assert.match(sync, /firstAuthoredChoice\(revision\?\.answer,result\.firstChoice\)/);
  assert.match(sync, /session\.firstChoice===null&&firstChoice!==null/);
  assert.match(single, /firstChoice:attempt\.progress\.firstChoice/);
  assert.match(contracts, /local_run_sync:[\s\S]*?firstChoice:z\.string/);
  assert.match(contracts, /local_single_sync:[\s\S]*?firstChoice:z\.string/);
});

test("rising and quality signals use minimum sample thresholds and avoid punitive moderation", () => {
  const insight=src("src/modules/platform/admin-content-insights.ts");
  for(const phrase of ["plays<10", "difference<8", "before<5", "difference/before<0.5",
    "starts>=20", "answered>=20", "accuracy<=0.2", "accuracy>=0.95"])assert.ok(insight.includes(phrase),phrase);
  assert.doesNotMatch(insight, /updateMany\(|\.delete\(|\.create\(/);
});

test("choice details and the insight cards are ADMIN-only and provide revision-aware analytics", () => {
  const dashboard=src("app/admin/analytics/page.tsx");
  const detail=src("app/admin/analytics/questions/[quizId]/page.tsx");
  assert.match(dashboard, /loadAdminContentInsights/);
  assert.match(dashboard, /Rising content/);
  assert.match(dashboard, /Content quality watchlist/);
  assert.match(dashboard, /\/admin\/analytics\/questions\//);
  assert.match(detail, /actor\.role!=="ADMIN"\)notFound\(\)/);
  assert.match(detail, /export const dynamic="force-dynamic"/);
  assert.match(detail, /s\."revisionId"=\$2/);
  assert.match(detail, /s\."firstChoice" IS NOT NULL/);
  assert.match(detail, /No choices have been captured/);
});

test("rising content type defaults to packs and ranks each type independently before Top 10", () => {
  const insight=src("src/modules/platform/admin-content-insights.ts");
  const dashboard=src("app/admin/analytics/page.tsx");
  const filters=src("src/modules/platform/admin-content-analytics.ts");
  assert.match(filters, /risingKind\?: string/);
  assert.match(insight, /value === "question" \? "question" : "pack"/);
  assert.match(insight, /risingKind: RisingKind = "pack"/);
  assert.match(insight, /risingKind === "question" \? risingContent\(q,oldQ,"question"\) : risingContent\(p,oldP,"pack"\)/);
  assert.match(insight, /\.sort\(\(a,b\)=>b\.difference-a\.difference \|\| b\.plays-a\.plays\)\.slice\(0,10\)/);
  assert.doesNotMatch(insight, /\.\.\.risingContent\(p,oldP,"pack"\),\.\.\.risingContent\(q,oldQ,"question"\)/);
  assert.match(dashboard, /resolveRisingKind\(query\.risingKind\)/);
  assert.match(dashboard, /loadAdminContentInsights\(filters, risingKind\)/);
  assert.match(dashboard, /name="risingKind" value=\{risingKind\}/);
  assert.match(dashboard, /risingQuery\(kind\)/);
  assert.match(dashboard, /sort: filters\.sort, risingKind: kind/);
  assert.match(dashboard, /tr\("Packs", "퀴즈팩"\)/);
  assert.match(dashboard, /tr\("Questions", "개별 문제"\)/);
});
