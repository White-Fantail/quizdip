import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("only completed pack results offer a result-image share card", () => {
  const player = read("app/(platform)/play/page.tsx");
  assert.match(player, /import PackResultShare from/);
  assert.match(player, /run\.mode==="PACK"&&packId&&run\.status==="FINISHED"&&confirmedRunId===run\.runId&&<PackResultShare/);
  assert.match(player, /score=\{run\.score\}/);
  assert.match(player, /completed=\{run\.completed\}/);
  assert.match(player, /solved=\{run\.solved\|\|0\}/);
  assert.match(player, /title=\{pack\?\.title/);
  assert.match(player, /<PackFeedback packId=\{packId\}/);
});

test("result image contains the pack title and scored outcome, not answer keys or run credentials", () => {
  const component = read("src/components/pack-result-share.tsx");
  for (const key of ["data.title", "data.score", "data.completed", "data.solved",
    "renderPng", "canvas.toBlob", '"image/png"', "createObjectURL", 'localizeHref("/packs/" + packId, locale)']) {
    assert.ok(component.includes(key), "Missing card requirement: " + key);
  }
  assert.doesNotMatch(component, /runToken|sessionToken|answerKey|leaderboardRank|qr-code|QRCode/i);
  assert.match(component, /createShareId/);
  assert.match(component, /publicResultUrl/);
});

test("a single result link share works through native Web Share or clipboard fallback", () => {
  const component = read("src/components/pack-result-share.tsx");
  assert.match(component, /navigator\.share\(\{ url \}\)/);
  assert.doesNotMatch(component, /navigator\.share\(\{[^}]*text:/);
  assert.doesNotMatch(component, /navigator\.share\(\{[^}]*title:/);
  assert.doesNotMatch(component, /isIOS \?|iPhone\|iPad\|iPod/);
  assert.match(component, /navigator\.clipboard\.writeText\(url\)/);
  assert.match(component, /anchor\.download = asset\.file\.name/);
  assert.match(component, /error\.name === "AbortError"/);
  assert.doesNotMatch(component, /navigator\.canShare|navigator\.share\(\{[^}]*files:/);
  assert.doesNotMatch(component, /shareSocial|shareInstagram|Facebook ↗|Instagram ↗|socialReadyFor/);
  assert.equal((component.match(/onClick=\{\(\) => void shareResult\(\)\}/g) || []).length, 1);
  assert.match(component, /"ko"/);
  assert.match(component, /"en-US"/);
});

test("result preview remains legible at mobile sizes", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.pack-result-share-preview/);
  assert.match(css, /aspect-ratio:4\/5/);
  assert.match(css, /\.pack-result-share-actions/);
  assert.match(css, /@media \(max-width:640px\)/);
});

test("old and new pack results use one share component and OG URLs", () => {
  const history=read("app/account/results/page.tsx");
  const finish=read("app/(platform)/play/page.tsx");
  const social=read("src/components/pack-result-share.tsx");
  const og=read("app/(platform)/results/[shareId]/page.tsx");
  const metadata=read("src/lib/public-result-metadata.ts");
  const img=read("src/modules/platform/result-og-image.tsx");
  const route=read("app/(platform)/results/[shareId]/og/route.ts");
  const proxy=read("proxy.ts");
  assert.ok(finish.includes("createShareId={async"));
  assert.ok(history.includes("createShareId={async"));
  assert.ok(history.includes("<PackResultShare"));
  assert.ok(history.includes("PAGE_SIZE"));
  assert.ok(social.includes("shareResult()"));
  assert.ok(social.includes("navigator.share({ url })"));
  assert.ok(!social.includes("publicResultSharePayload"));
  assert.ok(!social.includes("shareSocial("));
  assert.ok(og.includes("publicResultMetadata({"));
  assert.ok(og.includes("publicResultOrigin({"));
  assert.ok(metadata.includes("summary_large_image"));
  assert.ok(metadata.includes("openGraph"));
  assert.ok(img.includes("ImageResponse"));
  assert.ok(img.includes("width:1200,height:630"));
  assert.ok(route.includes("resultOgImage"));
  assert.match(proxy,/results.*og/);
  assert.ok(metadata.includes("/og?v=5"));
  assert.ok(metadata.includes("url,\n      siteName:"));
  assert.doesNotMatch(og+metadata, /preview=4/);
  assert.ok(img.includes("sharp("));
  assert.ok(img.includes("image.arrayBuffer()"));
  assert.equal((social.match(/Copy pack link/g)||[]).length,0);
  assert.ok(social.includes("publicResultUrl()"));
});

test("result publication is reversible and gated by completed pack and owner", () => {
  const runs=read("src/modules/platform/runs.ts");
  const contract=read("src/modules/platform/contracts.ts");
  const route=read("app/api/v1/[...segments]/route.ts");
  const schema=read("../../prisma/schema.prisma");
  for(const key of ["runShareGet", "shareableOwnedRun", 'run.status!=="FINISHED"', "userId", "safePack"]) {
    assert.ok(runs.includes(key));
  }
  assert.match(schema,/shareId\s+String\?\s+@unique/);
  for(const op of ["run_share","run_unshare","run_share_get"]) {
    assert.ok(contract.includes(op));
    assert.ok(route.includes(op));
  }
});

test("Open Graph brand dot is a font-independent CSS shape", () => {
  const img = read("src/modules/platform/result-og-image.tsx");
  assert.doesNotMatch(img, /QuizDip\s*●/);
  assert.match(img, /width:14,height:14,borderRadius:"50%",backgroundColor:"#fff"/);
  assert.match(img, /<span style=\{\{fontSize:42,fontWeight:800,letterSpacing:-2\}\}>QuizDip<\/span>/);
});
