import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("anonymous growth operations keep REST/MCP parity, admin gate and no identifiable schema",()=>{
  const schema=read("../../prisma/schema.prisma");
  const contracts=read("src/modules/platform/contracts.ts");
  const operations=read("src/modules/platform/operations.ts");
  const rest=read("app/api/v1/[...segments]/route.ts");
  const backend=read("src/modules/platform/growth-funnel.ts");
  assert.match(schema,/model GrowthFunnelDaily\s*\{/);
  assert.match(schema, /@@id\(\[day,event,locale,channel\]\)/);
  assert.doesNotMatch(schema.slice(schema.indexOf("model GrowthFunnelDaily"),schema.indexOf("model User")),/userId|sessionId|ipAddress|fingerprint|tokenHash/i);
  assert.match(contracts,/growth_event:\s*\{ public:true/);
  assert.match(contracts,/admin_growth_report:\s*\{ public:false/);
  assert.match(operations,/case "growth_event": return recordGrowthEvent/);
  assert.match(operations,/case "admin_growth_report": return adminGrowthReport/);
  assert.match(rest,/op:"growth_event"/);
  assert.match(rest,/op:"admin_growth_report"/);
  assert.match(backend,/actor\?\.role!=="ADMIN"/);
  assert.match(backend,/increment:1/);
});

test("first-visit play path is genuinely playable without a second selection or registration",()=>{
  const home=read("app/(platform)/page.tsx");
  const feature=read("src/components/home-featured-quiz.tsx");
  const play=read("app/(platform)/play/page.tsx");
  const single=read("app/(platform)/play/[quizId]/page.tsx");
  const tracking=read("src/lib/growth-tracking.ts");
  const share=read("src/components/quick-result-share.tsx");
  assert.match(home,/quizList\(/);
  assert.match(home,/HomeFeaturedQuiz/);
  assert.match(feature,/play\?quick=1&src=home/);
  assert.match(feature,/play\/"\+quiz\.id/);
  assert.match(play,/quickAutoStart\.current=true/);
  assert.match(play,/start\("RANDOM_FIVE"\)/);
  assert.match(play,/trackGrowth\("quick_start",locale\)/);
  assert.match(play,/trackGrowth\("first_answer",locale\)/);
  assert.match(single,/trackGrowth\("single_start",locale\)/);
  assert.match(share,/navigator\.share\(\{url\}\)/);
  assert.match(tracking,/globalPrivacyControl/);
  assert.match(tracking,/quizdip:growth:v1:/);
  assert.doesNotMatch(tracking,/userId|email|fingerprint|sessionToken/);
});

test("discover and listing packs now have direct play links with optional details",()=>{
  const packs=read("app/(platform)/packs/page.tsx");
  const discover=read("app/(platform)/discover/pack-browser.tsx");
  assert.match(packs,/play\?src=discover/);
  assert.match(discover,/play\?src=discover/);
  assert.match(discover,/Details/);
});
