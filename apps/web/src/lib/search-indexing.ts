import type { Locale } from "../i18n/core";

/** Stable production canonical origin; never use preview or OAuth host as an indexed URL. */
export const INDEX_ORIGIN = "https://quizdip.com";
export const INDEX_LOCALES = ["en", "ko"] as const;
const STATIC_PATHS = ["", "/discover", "/packs"] as const;

export function canonicalUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Expected an absolute site path");
  return new URL(path, INDEX_ORIGIN).href;
}

export function localizedPackUrl(packId: string, locale: Locale): string {
  return canonicalUrl(`/${locale}/packs/${encodeURIComponent(packId)}`);
}

export function staticSitemapEntries() {
  return INDEX_LOCALES.flatMap(locale => STATIC_PATHS.map(path => ({
    url: canonicalUrl(`/${locale}${path}`),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
    alternates: { languages: {
      en: canonicalUrl(`/en${path}`),
      ko: canonicalUrl(`/ko${path}`)
    } }
  })));
}
