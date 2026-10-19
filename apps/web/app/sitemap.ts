import type { MetadataRoute } from "next";
import { isLocale, type Locale } from "../src/i18n/core";
import { PlatformError } from "../src/modules/platform/auth";
import { db } from "../src/modules/platform/db";
import { safePack } from "../src/modules/platform/feature-eligibility";
import { INDEX_LOCALES, localizedPackUrl, staticSitemapEntries } from "../src/lib/search-indexing";

// A database-backed sitemap must not be statically frozen during deployment builds.
// Each crawl rechecks current publication, language, moderation and media status.
export const dynamic = "force-dynamic";

type PackEntry = { id: string; locale: Locale; updatedAt: Date };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const packs = await db().quizPack.findMany({
    where: {
      publication: "PUBLISHED",
      safetyStatus: "ACTIVE",
      localizations: { some: { status: "PUBLISHED", locale: { in: [...INDEX_LOCALES] } } },
      items: { some: { quiz: { publication: "PUBLISHED", safetyStatus: "ACTIVE" } } }
    },
    select: {
      id: true, updatedAt: true,
      localizations: {
        where: { status: "PUBLISHED", locale: { in: [...INDEX_LOCALES] } },
        select: { locale: true, updatedAt: true }
      }
    },
    orderBy: { id: "asc" }
  });
  const candidates: PackEntry[] = packs.flatMap(pack =>
    pack.localizations.filter(loc => isLocale(loc.locale)).map(loc => ({
      id: pack.id,
      locale: loc.locale as Locale,
      updatedAt: new Date(Math.max(pack.updatedAt.getTime(), loc.updatedAt.getTime()))
    }))
  );

  // safePack is the same authoritative filter used by public Discover/pack views:
  // a published pack without playable questions or with withdrawn media is omitted.
  // Bound concurrency so crawlers do not exhaust the production database pool.
  const playable: PackEntry[] = [];
  for (let offset = 0; offset < candidates.length; offset += 8) {
    const checked = await Promise.all(candidates.slice(offset, offset + 8).map(async candidate => {
      try {
        await safePack(candidate.id, candidate.locale, "GENERAL");
        return candidate;
      } catch (error) {
        if (error instanceof PlatformError && [404, 409].includes(error.status)) return null;
        throw error; // Surface infrastructure failures instead of publishing a misleading empty sitemap.
      }
    }));
    playable.push(...checked.filter((row): row is PackEntry => row !== null));
  }
  const languagesByPack = new Map<string, Locale[]>();
  for (const entry of playable) {
    const languages = languagesByPack.get(entry.id) ?? [];
    languages.push(entry.locale);
    languagesByPack.set(entry.id, languages);
  }
  const result: MetadataRoute.Sitemap = staticSitemapEntries();
  for (const entry of playable) {
    const languages = languagesByPack.get(entry.id) ?? [entry.locale];
    result.push({
      url: localizedPackUrl(entry.id, entry.locale),
      lastModified: entry.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
      ...(languages.length > 1 ? {
        alternates: { languages: Object.fromEntries(languages.map(locale =>
          [locale, localizedPackUrl(entry.id, locale)])) }
      } : {})
    });
  }
  return result;
}
