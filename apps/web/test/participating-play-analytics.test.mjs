import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const analytics = read("src/modules/platform/admin-content-analytics.ts");
const insights = read("src/modules/platform/admin-content-insights.ts");
const page = read("app/admin/analytics/page.tsx");

test("real play requires persisted answer activity, never merely opening a pack", () => {
  assert.match(analytics, /export const PARTICIPATED_RUN_SQL/);
  assert.match(analytics, /r\."solved" > 0 OR r\."failed" > 0/);
  assert.match(analytics, /activity\."runId" = r\."id"/);
  assert.match(analytics, /activity\."status" IN \('SOLVED', 'FAILED'\)/);
  assert.match(analytics, /activity\."wrongGuesses" > 0/);
  assert.doesNotMatch(analytics, /r\."currentIndex" > 0/);
});

test("created records stay countable without inflating pack participation, trends or completion rates", () => {
  assert.match(analytics, /COUNT\(\*\) AS created_runs/);
  assert.match(analytics, /COUNT\(\*\) FILTER \(WHERE \$\{PARTICIPATED_RUN_SQL\}\) AS plays/);
  assert.match(analytics, /r\."status" = 'FINISHED' AND \$\{PARTICIPATED_RUN_SQL\}/);
  assert.match(analytics, /HAVING COUNT\(\*\) FILTER \(WHERE \$\{PARTICIPATED_RUN_SQL\}\) > 0/);
  assert.match(analytics, /COUNT\(\*\) AS created_runs \$\{runJoins\}/);
  assert.match(analytics, /CASE WHEN \$\{PARTICIPATED_RUN_SQL\} THEN/);
  assert.doesNotMatch(analytics, /COUNT\(\*\) AS plays/);
  assert.match(insights, /PARTICIPATED_RUN_SQL/);
  assert.doesNotMatch(insights, /COUNT\(\*\) AS plays/);
});

test("question popularity excludes sessions with no guesses but quality keeps exposure dropoff", () => {
  assert.match(analytics, /export const ATTEMPTED_QUESTION_SQL/);
  assert.match(analytics, /s\."wrongGuesses" > 0/);
  assert.match(analytics, /HAVING COUNT\(\*\) FILTER \(WHERE \$\{ATTEMPTED_QUESTION_SQL\}\) > 0/);
  assert.match(insights, /COUNT\(\*\) AS exposures/);
  assert.match(insights, /COUNT\(\*\) FILTER \(WHERE \$\{ATTEMPTED_QUESTION_SQL\}\) AS plays/);
  assert.match(insights, /q\.exposures \?\? q\.plays/);
});

test("admin distinguishes allocated runs from answered ones while explaining offline sync", () => {
  for (const label of ["실행 기록 생성", "실제 참여", "응답 없는 실행"])
    assert.ok(page.includes(label), label);
  assert.match(page, /data\.totals\.createdRuns - data\.totals\.plays/);
  assert.match(page, /오프라인 팩 결과는 동기화 후 반영됩니다/);
  assert.match(page, /기간별 실제 참여 추이/);
});
