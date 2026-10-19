import type { MetadataRoute } from "next";
import { INDEX_LOCALES, INDEX_ORIGIN } from "../src/lib/search-indexing";

const PRIVATE_PATHS = ["api", "admin", "account", "studio", "sign-in", "consent"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Non-public UI is intentionally absent from the sitemap and discouraged for crawlers.
      disallow: [
        ...PRIVATE_PATHS.map(path => `/${path}`),
        ...INDEX_LOCALES.flatMap(locale => PRIVATE_PATHS.map(path => `/${locale}/${path}`))
      ]
    },
    sitemap: `${INDEX_ORIGIN}/sitemap.xml`,
    host: INDEX_ORIGIN
  };
}
