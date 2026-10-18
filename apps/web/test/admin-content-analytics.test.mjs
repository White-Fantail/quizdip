import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("content analytics is reachable only behind the platform ADMIN gate", () => {
  const home = source("app/admin/page.tsx");
  const page = source("app/admin/analytics/page.tsx");
  assert.match(home, /localizeHref\("\/admin\/analytics",locale\)/);
  assert.match(page, /await actorFor\(/);
  assert.match(page, /if \(!actor\) redirect\(/);
  assert.match(page, /if \(actor.role !== "ADMIN"\) notFound\(\)/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(page, /"use client"/);
});

test("filters cover custom and standard periods, locale, Kids, play modes and creators", () => {
  const service = source("src/modules/platform/admin-content-analytics.ts");
  const page = source("app/admin/analytics/page.tsx");
  for (const period of ["today", "yesterday", "7", "30", "90", "all", "custom"])
    assert.match(service, new RegExp('"' + period + '"'));
  for (const field of ["period", "start", "end", "locale", "audience", "mode", "creator", "sort"])
    assert.match(page, new RegExp('name="' + field + '"'));
  assert.match(service, /Pacific\/Auckland/);
  assert.match(service, /previousStart/);
  assert.match(service, /\$[1-9]::text/);
});

test("plays are counted by persisted run starts and questions by opened sessions, not planned run slots", () => {
  const service = source("src/modules/platform/admin-content-analytics.ts");
  assert.match(service, /FROM "PlayRun" r/);
  assert.match(service, /FROM "PlaySession" s/);
  assert.match(service, /r\."startedAt"/);
  assert.match(service, /s\."startedAt"/);
  assert.match(service, /s\."status" IN \('SOLVED', 'FAILED'\)/);
  assert.match(service, /'user:' \|\| r\."userId"/);
  assert.match(service, /'kid:' \|\| kr\."profileId"/);
  assert.doesNotMatch(service, /FROM "PlayRunQuestion"\s+s/);
});

test("analytics indexes have corresponding Prisma schema declarations", () => {
  const schema = source("../../prisma/schema.prisma");
  const sql = readFileSync(new URL("../../../prisma/migrations/20261019010000_admin_content_analytics/migration.sql", import.meta.url), "utf8");
  assert.match(schema, /model PlayRun \{[\s\S]*?@@index\(\[startedAt\]\)/);
  assert.match(schema, /model PlaySession \{[\s\S]*?@@index\(\[startedAt\]\)/);
  assert.match(sql, /PlayRun_startedAt_idx/);
  assert.match(sql, /PlaySession_startedAt_idx/);
});
