# AdSense content readiness — QuizDip (November 2026)

## Why this change exists
AdSense site review flagged quizdip.com for "Low value content". This is a general
site-review reason, **not** an indication of which URL or rule failed. Passing
unit tests or re-review cannot guarantee Google approval.

## Current public information architecture
- `/{locale}/packs` is server-rendered, with currently playable published
  packs and creator-written descriptions. Image licensing footnotes are kept
  separate from descriptions in public catalogs.
- `/{locale}/packs/{id}` is server-rendered with original pack introduction,
  author, count, version, ratings, play action and a no-spoiler play guide.
  Chapter introductions and unrevealed clues stay inside the actual game.
- `/{locale}/discover` retains interactive discovery, and also server-renders up
  to six verified, published and playable quiz prompts with links. Answers and
  unrevealed clues are never sent to the public preview. A link to the
  server-rendered full pack catalog remains.
- `/{locale}/about` explains creation, AI assistance, source limitations,
  content corrections, reports, versioning and Kids moderation in both
  supported languages.
- Interactive `/play` and pack `/play` routes are noindex; the public
  catalog/detail pages remain indexable. No game answers are added to metadata.
- The sitemap includes localized /about, /privacy, /contact and /terms routes.
- A verified private support mailbox can be configured with `QUIZDIP_SUPPORT_EMAIL`.
  Without it, public GitHub issues accept only non-sensitive general feedback.
  Never invite privacy requests or personal details into public issues.

## Verification and review checklist
1. Run `npm run test`, `npm run typecheck`, `npm run build`.
2. From the production domain, inspect `/en/about`, `/ko/about`,
   `/en/packs`, `/ko/packs`, a real pack detail, `/robots.txt` and
   `/sitemap.xml`. Confirm rendered HTML (not just hydrated UI) includes
   the pack introduction and navigable internal links.
3. In Search Console, use **URL Inspection → Test Live URL** on representative
   pack pages; verify Googlebot can fetch and render them. Submit or refresh
   the sitemap and inspect indexing reports.
4. Manually review a representative cross-section of published packs for
   factual accuracy, originality, duplicate questions, meaningful explanations,
   creator descriptions, functional source URLs, and spam or restricted content.
   Do not claim that all material has been fact-checked automatically.
5. Ensure advertising is not displayed on empty or navigational game states,
   Ads.txt and owner verification are correct, and Kids content remains ad-free.
6. After confirmed production checks and substantive editorial improvements,
   check "issues fixed" and request a new AdSense review. Only Google can
   determine whether the site is approved.

## Limitations
Automated source tests cannot reproduce the AdSense crawler's scoring, human
review, traffic signals, indexing decisions or real production HTML. New
explanatory text and technical noindex controls do not replace genuinely
helpful, original quiz content and ongoing human editorial checks.
