import assert from "node:assert/strict";
import test from "node:test";
import { publicResultMetadata, publicResultOrigin } from "../src/lib/public-result-metadata.ts";

const origin = "https://quizdip.com";
const shareId = "f128d905-fb7c-4491-bca3-ccddca7bbb84";

for (const locale of ["ko", "en"]) {
  test(`shared ${locale} result uses one URL for the shared link, canonical, and Open Graph`, () => {
    const result = publicResultMetadata({
      shareId, locale, origin,
      packTitle: "Test quiz", score: 920, completed: 12, solved: 10,
    });
    const expected = `${origin}/${locale}/results/${shareId}`;
    const image = `${origin}/results/${shareId}/og?v=4`;
    assert.equal(result.alternates.canonical, expected);
    assert.equal(result.openGraph.url, expected);
    assert.equal(new URL(result.openGraph.url).search, "");
    assert.equal(result.openGraph.images[0].url, image);
    assert.equal(result.openGraph.images[0].width, 1200);
    assert.equal(result.openGraph.images[0].height, 630);
    assert.equal(result.twitter.images[0], image);
    assert.equal(result.openGraph.locale, locale === "ko" ? "ko_KR" : "en_US");
    assert.equal(result.robots.index, false);
    assert.match(result.openGraph.title, /QuizDip/);
    assert.equal(result.openGraph.title, result.title);
  });
}

test("preview metadata uses the preview deployment's host instead of production", () => {
  const preview = publicResultOrigin({
    VERCEL_ENV: "preview",
    VERCEL_URL: "quizdip-git-fix-example.vercel.app",
    PUBLIC_ORIGIN: origin,
  });
  assert.equal(preview, "https://quizdip-git-fix-example.vercel.app");
  const result = publicResultMetadata({
    shareId, locale: "ko", origin: preview,
    packTitle: "Test", score: 10, completed: 1, solved: 1,
  });
  assert.equal(result.openGraph.url, `${preview}/ko/results/${shareId}`);
  assert.equal(result.alternates.canonical, result.openGraph.url);
});

test("production metadata always honors configured public origin", () => {
  assert.equal(publicResultOrigin({
    VERCEL_ENV: "production",
    VERCEL_URL: "quizdip-temp.vercel.app",
    PUBLIC_ORIGIN: "https://quizdip.com/",
  }), origin);
  assert.equal(publicResultOrigin({
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "quizdip.example.org",
  }), "https://quizdip.example.org");
  assert.equal(publicResultOrigin({}), origin);
});
