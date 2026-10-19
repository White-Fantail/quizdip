import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canonicalUrl, INDEX_ORIGIN, localizedPackUrl, staticSitemapEntries
} from "../src/lib/search-indexing.ts";

test("sitemap always points to the canonical QuizDip domain and bilingual routes", () => {
  assert.equal(INDEX_ORIGIN, "https://quizdip.com");
  const entries = staticSitemapEntries();
  assert.equal(entries.length, 6);
  assert.deepEqual(entries.map(item => new URL(item.url).pathname),
    ["/en", "/en/discover", "/en/packs", "/ko", "/ko/discover", "/ko/packs"]);
  for (const entry of entries) {
    assert.equal(new URL(entry.url).host, "quizdip.com");
    assert.equal(entry.alternates.languages.en.startsWith("https://quizdip.com/en"), true);
    assert.equal(entry.alternates.languages.ko.startsWith("https://quizdip.com/ko"), true);
  }
  assert.equal(localizedPackUrl("a-b", "ko"), "https://quizdip.com/ko/packs/a-b");
  assert.equal(canonicalUrl("/en/packs"), "https://quizdip.com/en/packs");
  assert.throws(() => canonicalUrl("//other-site.example/path"));
});

test("sitemap uses safe public playability and does not list account or studio content", () => {
  const code = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  assert.match(code, /publication: "PUBLISHED"/);
  assert.match(code, /safetyStatus: "ACTIVE"/);
  assert.match(code, /safePack\(candidate.id, candidate.locale, "GENERAL"\)/);
  assert.match(code, /dynamic = "force-dynamic"/);
  const metadata = readFileSync(new URL("../app/(platform)/packs/[packId]/page.tsx", import.meta.url), "utf8");
  assert.match(metadata, /canonicalUrl\(localizeHref\("\/packs\/"\+pack.id,locale\)\)/);
  const robots = readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
  assert.match(robots, /sitemap: /);
  assert.match(robots, /"admin", "account", "studio"/);
});
