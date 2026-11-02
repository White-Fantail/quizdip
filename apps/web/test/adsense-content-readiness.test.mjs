import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("public pages explain the real game without leaking unrevealed chapter narratives", () => {
  const home = read("app/(platform)/page.tsx");
  const detail = read("app/(platform)/packs/[packId]/page.tsx");
  const about = read("app/(platform)/about/page.tsx");
  assert.match(home, /id="how-it-works"/);
  assert.match(home, /href={url\("\/packs"\)}/);
  assert.match(detail, /id="pack-guide-heading"/);
  assert.match(detail, /pack\.questionCount/);
  assert.doesNotMatch(detail, /pack\.sections\.map/);
  assert.match(detail, /<PackReport packId={pack\.id}\/>/);
  assert.match(about, /independently fact-checked/);
  assert.match(about, /Kids eligibility/);
});

test("discover has crawlable server-rendered link to published pack library", () => {
  const layout = read("app/(platform)/discover/layout.tsx");
  assert.doesNotMatch(layout, /"use client"/);
  assert.match(layout, /localizeHref\("\/packs",locale\)/);
  const serverList = read("app/(platform)/packs/page.tsx");
  assert.match(serverList, /await packList/);
  for(const file of ["app/(platform)/packs/page.tsx", "app/(platform)/discover/pack-browser.tsx"])
    assert.match(read(file), /splitPackDescription\(pack\.description\|\|""\)\.intro/);
});

test("interactive game URLs are not indexed as thin content pages", () => {
  for(const path of ["app/(platform)/play/layout.tsx", "app/(platform)/packs/[packId]/play/layout.tsx"])
    assert.match(read(path), /robots:\s*\{ index: false, follow: true \}/);
});

test("sitemap and footer link to transparent content standards", () => {
  assert.match(read("src/lib/search-indexing.ts"), /"\/about"/);
  assert.match(read("app/layout.tsx"), /localizeHref\("\/about", locale\)/);
});
