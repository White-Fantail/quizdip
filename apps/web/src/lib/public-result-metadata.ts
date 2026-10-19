import type { Metadata } from "next";

/**
 * The public result URL is the single identity for the page in Facebook's graph.
 * Never add a cache-busting query to og:url: use the image URL for image revisions.
 */
export function publicResultMetadata({
  shareId, locale, packTitle, packVersion, score, completed, solved, origin,
}: {
  shareId: string;
  locale: "ko" | "en";
  packTitle: string;
  packVersion?: number | null;
  score: number;
  completed: number;
  solved: number;
  origin: string;
}): Metadata {
  const korean = locale === "ko";
  const version=packVersion!=null?` · v${packVersion}`:"";
  const title = korean
    ? `${packTitle}${version} · ${score}점 · QuizDip`
    : `${packTitle}${version} · ${score} points · QuizDip`;
  const description = korean
    ? `${completed}문제 중 ${solved}문제 정답. 같은 버전에서 나온 결과끼리 비교해 주세요.`
    : `${solved} correct out of ${completed}. Compare results only from the same pack version.`;
  const url = new URL(`/${locale}/results/${shareId}`, origin).href;
  const image = new URL(`/results/${shareId}/og?v=5`, origin).href;

  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: { canonical: url },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      // Matches the real shared URL and the HTML canonical exactly.
      url,
      siteName: "QuizDip",
      locale: korean ? "ko_KR" : "en_US",
      images: [{ url: image, width: 1200, height: 630, type: "image/png", alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/**
 * On Vercel preview deploys, use the deployment's public origin so a shared
 * preview link doesn't tell Facebook to resolve its OG identity on production.
 * Production remains pinned to the configured public origin.
 */
export function publicResultOrigin(env: {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  PUBLIC_ORIGIN?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}): string {
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return new URL("https://" + env.VERCEL_URL.replace(/^https?:\/\//, "")).origin;
  }
  return new URL(env.PUBLIC_ORIGIN ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? "https://" + env.VERCEL_PROJECT_PRODUCTION_URL
      : "https://quizdip.com")).origin;
}
