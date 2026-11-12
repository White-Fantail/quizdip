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

test("real pack previews are server-rendered from policy-cleared published revision prompts only", () => {
  const service=read("src/modules/platform/social.ts");
  const start=service.indexOf("const previewItems=safe.items.slice(0,8)");
  const end=service.indexOf("const ending=pack.sourceLocale===locale",start);
  assert.ok(start>0 && end>start);
  const preview=service.slice(start,end);
  assert.match(preview,/previewItems\.map\(item=>item\.revisionId\)/);
  assert.match(preview,/select:\{id:true,prompt:true\}/);
  assert.doesNotMatch(preview,/select:\{[^}]*\b(?:answer|clues|explanation)\b/);
  assert.match(service,/scoreReviews:reviews,questionPreviews/);
  const page=read("app/(platform)/packs/[packId]/page.tsx");
  assert.match(page,/pack\.questionPreviews\.map/);
  assert.match(page,/\{preview\.prompt\}/);
  assert.doesNotMatch(page,/\{preview\.answer\}/);
});

test("public homepage links to real published packs; list and discovery have locale-specific canonical metadata",()=>{
  const home=read("app/(platform)/page.tsx");
  assert.match(home,/await Promise\.all/);
  assert.match(home,/packList\(\{limit:6,offset:0,locale,mine:false\},null\)/);
  assert.match(home,/href=\{url\("\/packs\/"\+pack\.id\)\}/);
  for(const path of ["app/(platform)/packs/page.tsx","app/(platform)/discover/layout.tsx"]){
    const content=read(path);
    assert.match(content,/export async function generateMetadata/);
    assert.match(content,/alternates:\{canonical:url/);
    assert.match(content,/canonicalUrl\("\/en\//);
    assert.match(content,/canonicalUrl\("\/ko\//);
  }
});

test("Discover response includes server-rendered published question previews without revealing clues",()=>{
  const layout=read("app/(platform)/discover/layout.tsx");
  const service=read("src/modules/platform/public-discover-preview.ts");
  assert.doesNotMatch(layout,/"use client"/);
  assert.match(layout,/await publicDiscoverPreview\(locale\)/);
  assert.match(layout,/previews\.map\(quiz=>/);
  assert.match(layout,/quiz\.prompt/);
  assert.match(layout,/localizeHref\("\/play\/"\+quiz\.id,locale\)/);
  assert.match(service,/quizList\(\{locale,mine:false,kids:false,offset:0,limit:18\},null\)/);
  assert.match(service,/safeQuiz\(quiz\.id,locale,"GENERAL"\)/);
  assert.doesNotMatch(service,/return \{[^}]*answer:/);
  assert.doesNotMatch(service,/return \{[^}]*clues:/);
});
test("contact, terms and privacy routes are bilingual, indexed and in footer",()=>{
  const footer=read("app/layout.tsx"), indexing=read("src/lib/search-indexing.ts");
  for(const slug of ["privacy","contact","terms"]){
    const page=read("app/(platform)/"+slug+"/page.tsx");
    assert.match(page,/export async function generateMetadata/);
    assert.match(page,/alternates:\{canonical:url,languages:/);
    assert.ok(page.includes('canonicalUrl("/en/'+slug+'")'));
    assert.ok(page.includes('canonicalUrl("/ko/'+slug+'")'));
    assert.ok(footer.includes('localizeHref("/'+slug+'", locale)'));
    assert.ok(indexing.includes('"/'+slug+'"'));
  }
  assert.match(read("app/(platform)/contact/page.tsx"),/QUIZDIP_SUPPORT_EMAIL/);
});
