import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Discover leads with playable packs, not a separate browse-packs entrance", () => {
  const page = read("app/(platform)/discover/page.tsx");
  const spotlight = read("app/(platform)/discover/pack-spotlight.tsx");
  assert.ok(page.indexOf("<PackSpotlight") < page.indexOf("discover-content"));
  assert.doesNotMatch(page, /Browse quiz packs →/);
  assert.match(page, /onBrowsePacks=\{\(\) => updateListing\(\{view:"PACK",packPage:"1"\}\)\}/);
  assert.match(spotlight, /"\/packs\/".*?pack.id \+ "\/play"/s);
  assert.match(spotlight, /quiz pack/i);
  assert.match(spotlight, /questionCount/);
});

test("no pack becomes popular merely by being published", () => {
  const discovery = read("src/modules/platform/discovery.ts");
  const spotlight = read("app/(platform)/discover/pack-spotlight.tsx");
  assert.match(discovery, /key:"popular_packs"/);
  assert.match(discovery, /packRows.filter\(r=>r.card.started>=3\)/);
  assert.match(discovery, /key:"new_packs"/);
  assert.match(discovery, /card:r.card,score:Date.parse\(r.card.createdAt\)/);
  assert.match(spotlight, /const popular = packSection\("popular_packs"\)/);
  assert.match(spotlight, /const newlyDiscovered = packSection\("new_packs"\)/);
  assert.match(spotlight, /\[catalogRows, false\]/);
  assert.match(spotlight, /popular \? \(ko \? "인기 퀴즈팩"/);
});

test("pack spotlight honors discover safety and localization gates and deduplicates rankings", () => {
  const discovery = read("src/modules/platform/discovery.ts");
  const packList = read("src/modules/platform/social.ts");
  const component = read("app/(platform)/discover/pack-spotlight.tsx");
  const list = read("app/(platform)/discover/discovery-sections.tsx");
  const client = read("app/(platform)/discover/discovery-client.ts");
  assert.match(discovery, /playableQuizWhere\(locale\)/);
  assert.match(discovery, /moderationStatus:"APPROVED"/);
  assert.match(discovery, /const featured=rows.filter\(r=>!r.bad\)/);
  assert.match(packList, /safePack\(pack.id,locale,"GENERAL"\)/);
  assert.match(component, /locale=" \+ locale/);
  assert.match(component, /new Set<string>\(\)/);
  assert.match(component, /loadDiscoverySections\(locale,rotation\)/);
  assert.match(list, /Object.prototype.hasOwnProperty.call\(names,s.key\)/);
  assert.match(list, /if \(!loading && !present.length\) return null/);
  assert.match(client, /const inFlight = new Map/);
});

test("Discover card descriptions do not overlap creator and metadata", () => {
  const css = read("app/globals.css");
  const ranked = read("app/(platform)/discover/discovery-sections.tsx");
  const catalog = read("app/(platform)/discover/pack-browser.tsx");
  const questions = read("app/(platform)/discover/page.tsx");
  assert.match(css, /\.discover-card p\s*\{[^}]*min-height:0;[^}]*\}/);
  assert.doesNotMatch(css, /\.discover-card p\s*\{[^}]*flex\s*:\s*1\b/);
  assert.match(css, /\.discover-card-description\s*\{[^}]*-webkit-line-clamp:4;[^}]*overflow:hidden;/);
  assert.match(ranked, /className="discover-card-description"[^>]*>\{item.subtitle\}/);
  assert.match(catalog, /className="discover-card-description"[^>]*>\{pack.description\}/);
  assert.match(questions, /className="discover-card-description"[^>]*>\{quiz.prompt\}/);
});
