# Search indexing and sitemaps

QuizDip's production search origin is **https://quizdip.com**, regardless of
the Vercel preview host or OAuth configuration.

- `/sitemap.xml` is a server-rendered Next.js metadata route. It lists
  `/en`, `/ko`, their public Discover and packs indexes, and **currently playable**
  localized pack landing pages. It does not list drafts, restricted packs,
  unavailable translations, packs with no playable questions, or private routes.
  Public eligibility is rechecked using the same `safePack` used by Discover.
- Language-specific pack entries use the corresponding published locale, and
  hreflang alternatives are emitted only when both versions are playable.
- `/robots.txt` advertises the sitemap and discourages indexing of
  auth/account/studio/admin/API screens in both languages.
- Individual quiz **gameplay** pages are omitted for now because the client-only
  play screen is not a descriptive server-rendered landing page for Google.
  Add an indexable SSR preview page and metadata before including them.
- The sitemap is force-dynamic to avoid requiring a production database during
  Vercel builds. Published pack changes become visible on subsequent crawls.
  For significantly larger catalogs, shard sitemaps before exceeding 50,000
  URLs or 50 MB uncompressed per sitemap.
- REST/MCP parity: SEO crawler metadata is a public infrastructure route,
  not a QuizDip product operation. No REST or MCP operation is added.

## Launch checklist

1. Deploy the change to **production**, then open
   https://quizdip.com/sitemap.xml and https://quizdip.com/robots.txt.
2. Verify the sitemap lists /en and /ko pack URLs and omits known draft or
   restricted packs. Test one link in both languages.
3. In **Google Search Console**, verify the **quizdip.com** domain property,
   select **Sitemaps**, and submit `https://quizdip.com/sitemap.xml`.
4. Use **Pages / URL Inspection** to check indexing over the next few days.
   Submission helps discovery but is not a guarantee of indexing or ranking.
