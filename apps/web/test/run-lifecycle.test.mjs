import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { effectiveRunStatus, RUN_IDLE_MS } from "../src/modules/platform/run-lifecycle.ts";
import { parseOperation } from "../src/modules/platform/contracts.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const schema=read("../../prisma/schema.prisma");
const migration=read("../../prisma/migrations/20261020103000_guest_pack_start_idempotency/migration.sql");
const runs=read("src/modules/platform/runs.ts");
const player=read("app/(platform)/play/page.tsx");
const admin=read("app/admin/directory/page.tsx");

test("an unsubmitted run becomes idle in admin but stays resumable until expiry",()=>{
  const now=new Date("2026-10-20T09:00:00Z");
  const base={status:"ACTIVE",startedAt:new Date(now.getTime()-RUN_IDLE_MS+1000),
    expiresAt:new Date(now.getTime()+30*86400000),solved:0,failed:0};
  assert.equal(effectiveRunStatus(base,false,now),"NOT_STARTED");
  assert.equal(effectiveRunStatus({...base,startedAt:new Date(now.getTime()-RUN_IDLE_MS-1)},false,now),"IDLE");
  assert.equal(effectiveRunStatus({...base,startedAt:new Date("2026-10-01")},true,now),"ACTIVE");
  assert.equal(effectiveRunStatus({...base,failed:1},false,now),"ACTIVE");
  assert.equal(effectiveRunStatus({...base,expiresAt:now},false,now),"EXPIRED");
  assert.equal(effectiveRunStatus({...base,status:"EXPIRED"},true,now),"EXPIRED");
  assert.equal(effectiveRunStatus({...base,status:"FINISHED",expiresAt:now},true,now),"FINISHED");
});

test("admin status filters classify before pagination and keep historical rows",()=>{
  for(const label of ["NOT_STARTED","IDLE","EXPIRED","FINISHED","ACTIVE"])
    assert.ok(admin.includes(label),label);
  assert.match(admin,/db\(\)\.playRun\.count\(\{where\}\)/);
  assert.match(admin,/where,orderBy:\{startedAt:"desc"\},skip,take: LIMIT/);
  assert.match(admin,/effectiveRunStatus\(run,run\.sessions\.length>0,now\)/);
  assert.match(admin,/UNANSWERED_RUN_FILTER/);
  assert.match(admin,/ANSWERED_RUN_FILTER/);
  assert.doesNotMatch(admin,/db\(\)\.playRun\.delete/);
});

test("guest starts have a secret bearer token and a database-level unique nonce hash",()=>{
  const key="6cb258da-0f4b-439e-81e8-362327a819d1";
  const req=parseOperation("run_start",{mode:"PACK",packId:key,guestStartKey:key});
  assert.equal(req.guestStartKey,key);
  assert.throws(()=>parseOperation("run_start",{mode:"PACK",packId:key,guestStartKey:"guessable"}));
  assert.match(schema,/guestStartKeyHash String\? @unique/);
  assert.match(migration,/CREATE UNIQUE INDEX "PlayRun_guestStartKeyHash_key"/);
  assert.match(runs,/guestRunToken\(runId:string, startKey:string\)/);
  assert.match(runs,/matchingToken\(runToken,existing\.tokenHash\)/);
  assert.match(runs,/if\(\(error as \{code\?:string\}\)\?\.code==="P2002"&&guestKey\)/);
  assert.match(runs,/guestStartKeyHash:guestKeyHash/);
  assert.match(player,/localStorage\.getItem\(guestKeyName\)/);
  assert.match(player,/localStorage\.setItem\(guestKeyName,guestStartKey\)/);
  assert.match(player,/navigator\.locks\.request/);
  assert.match(player,/localStorage\.setItem\(storageKey,JSON\.stringify\(started\)\)/);
});

test("expired runs are swept only after original expiry through authenticated daily cron",()=>{
  const route=read("app/api/internal/run-expiry/route.ts");
  const vercel=JSON.parse(read("vercel.json"));
  assert.deepEqual(vercel.crons,[{path:"/api/internal/run-expiry",schedule:"0 3 * * *"}]);
  assert.match(route,/process\.env\.CRON_SECRET/);
  assert.match(route,/timingSafeEqual/);
  assert.match(route,/status:"ACTIVE",expiresAt:\{lte:new Date\(\)\}/);
  assert.match(route,/data:\{status:"EXPIRED"\}/);
  assert.doesNotMatch(route,/deleteMany|startedAt:\{lte/);
  assert.match(runs,/run\.status === "EXPIRED"/);
  assert.match(migration,/PlayRun_status_expiresAt_idx/);
});
