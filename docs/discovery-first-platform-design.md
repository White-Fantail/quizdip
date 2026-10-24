# QuizDip Discovery-first Platform — Revised Design (2026-10-12)

**Status:** Implemented in stages on `dev` through Phase 4 (verification and deployment may still be pending). No `main` merge or production migration authorized.  
**Branch:** `dev`. **Supersedes:** `docs/quiz-pack-first-design.md` wherever it describes Weekly Five as a continuing feature. The prior document remains a technical reference for pack publication, run snapshots, ratings and translations.  
**Outcome:** Quiz and QuizPack are independent shareable, rateable, playable content. Discover, evidence-based discovery and transparent editor curation replace the scheduled weekly competition.

## Implementation status (dev, 2026-10-12)

**Native Kids safety behavior:** the Kids pack list is generated only with a guardian-pinned original language and age band, affirmative pack-level approval, individually approved quizzes/revisions/media, and a valid native device. Pack play saves immutable server-side order and signed device-scoped tokens; it rechecks the whole pack and media on each clue/guess and honors server-controlled daily/session limits. No public child ratings or statistics. Author edits invalidate Kids approval; an ADMIN RESTRICTED pack remains restricted until an administrator explicitly changes it.

**Editorial behavior:** Admin picks have exclusive QUIZ/PACK FKs, locale, audience (GENERAL/KIDS), HERO/ROW placement, priority, label/copy and UTC start/end window. Both REST and MCP use the same validation and audit paths; public reads recheck publication, locale, media, Kids approval, and timing. Headline text cannot confer a verified creator identity. The UI presents an explicit "Editor's Pick" label, not an algorithmic popularity claim.


- **Phase 1:** retired proposed Weekly Five entry points, introduced per-run `targetCount`.
- **Phase 2:** Studio pack management and publish preflight/confirmation, shared REST/MCP.
- **Phase 3:** localized, immutable `PACK` runs with authenticated resume, pack listing/details and full-length web play.
- **Phase 4:** per-pack order mode and one-time per-run randomized snapshot, independent `PackReview`/`PackReport`, server-verified reactions, pack owner insights, social share metadata/buttons, and Discover evidence-backed sections/tabs. Ranking is limited to a bounded recently updated eligible catalog, signed-in adult metrics, and sample floors; no claim of global all-time ranking.
- **Phase 5 (source implemented on dev):** ADMIN editorial picks and schedules (independent from organic rankings), eligible candidate search, pause/reorder/remove with audit, separate pack-level Kids moderation, and native Kids pack catalog/play/resume and curated recommendations. Weekly Five code and DB models were removed once confirmed unused; the clean-up migration refuses to run if historical weekly data is discovered.
- **Creator credentials intentionally not automated:** an Editor's Pick is never a verified celebrity/expert badge. Identity verification needs evidence, consent and a separate moderation workflow before any such badge can be introduced.

**Production rollout prerequisites:** apply all ordered Prisma migrations, including `20261013030000_editorial_and_kids_packs` and `20261013040000_remove_unused_weekly_challenges`, after checking the removal precondition against real data. Validate on a staging copy, and perform authenticated Admin/Studio and paired native Kids device tests. The deployment still requires explicit main-branch approval. CI is source validation, not operational proof. Creator-order is the backward-compatible default for existing packs.

## Product decisions

1. **Discover** is the primary experience; include questions and quiz packs as equal content types. Promote what people actually enjoy and find challenging, not a mandated five-question event.
2. **Quiz packs** have creator-controlled ordered members and an explicit `orderMode=CREATOR|RANDOM` (default `CREATOR`). `RANDOM` is shuffled exactly once when a new run starts, with the resulting permutation and revision IDs pinned; resuming never reshuffles. Each pack has its own public URL, cover/title/description, reviews, statistics and resumable full-pack play regardless of pack size. One quiz may appear in multiple packs without duplicating quiz revisions or quiz feedback.
3. **Random play** is always accessible as an endless stream, avoiding already-seen questions. "Random five" is only a gentle quick-start tutorial/preset for visitors who want a short game. After five, offer "five more" or "keep going"; never manufacture an author-owned pack from random items.
4. **No Weekly Five**: no recurring celebrity challenge, exactly-five editorial constraint, weekly leaderboard, proposal/schedule, or reserved questions. An unused Weekly Five schema is removed with an explicit data-emptiness guard.
5. **Editorial promotion** is available to ADMIN for any qualifying question or pack, without claiming the item is organically popular. A verified celebrity/expert badge is independent of being featured.

## Discover homepage / dashboard

Top-level navigation: `Discover | Play | Studio | Account`. Discover offers `All | Packs | Questions` plus search/locale/topic/audience/difficulty filters; server-side pagination.

Recommended sections (collapse a row when the sample is insufficient):
- **Editor's Picks (추천 콘텐츠):** curated question/pack spotlight with explicit label, creator attribution, optional scheduling, and share/play actions. Works for celebrity-created packs, expert collections and ordinary emerging creators.
- **Trending now (지금 인기):** strong qualified engagement growth over a rolling seven-day window relative to previous activity, not a weekly competition.
- **Popular (많이 풀어본):** recent qualified unique plays and completions, ranked within question vs pack type (rolling 30 days; optional all-time browsing).
- **Highly Rated (평가가 좋은):** positive reactions plus count; sort using a conservative Bayesian/Wilson-style adjustment so one like does not outrank hundreds of solid reviews.
- **Challenge yourself (어려운 퀴즈):** question difficulty inferred from wrong answers, solve rates, and clue stages; pack difficulty from member performance and length-normalized completion measures.
- **New & Undiscovered (새로운 발견):** newly published content and underexposed creators so existing viral packs do not monopolize discovery.
- **Continue your pack (이어 풀기):** personalized, private, sign-in-based `12/30` progress; not indexed publicly.

Play landing should focus on "Explore quizzes/packs", "Random play" and "Continue" when relevant. A first visit can present an **optional** five-question introduction, but there is no permanent five-question product framing. A quiz shared by link opens directly as a single question; pack links open localized pack detail and start/resume the entire pack.

## Popularity, quality and difficulty rules

The database's `PlaySession`, `PlayRun`, `PlayRunQuestion`, quiz reviews and new pack reviews are the authoritative data. Never use client-only reports of solved/completed events as ranking proof. Maintain raw analytics separately from deduplicated discovery metrics.

- **Qualified events**: count legitimate session plays/completions, constrain repeated self-refreshes and suspicious bursts, deduplicate multiple attempts by one account for ranking within a window. Guest events receive more limited weight unless trustworthy; protect privacy rather than fingerprint devices.
- **Ratings**: quiz reactions and pack reactions are independent and locale-scoped. Only expose a public sentiment percentage when at least five legitimate reactions exist; use smoothed lower-confidence ranking scores. Authors cannot rate their own content. Users must finish the given question/pack to rate it.
- **Hard quiz**: require a minimum sample of independent completed players, then combine actual failure rate, guess patterns and clue depth. High reports of wrong answers/broken media suppress a quiz instead of making it "hard".
- **Hard pack**: combine its member difficulty with length-adjusted observed completion and progression metrics. A 60-question pack is not automatically ranked harder simply because it takes longer than a five-question pack.
- **Trending**: recent growth versus baseline with minimum qualified activity; no trend claim without adequate data. Small catalog fallback: show New or Editor's Picks instead.
- **Fairness**: diversify across authors and subjects, give small creators limited exploration exposure and prevent clones/spam from overwhelming results. Filter all results by current publication, language availability, moderation, approved media and Kids eligibility on every request.
- **Kids**: adult content statistics never override independent Kids approval or guardian settings. Do not publicly expose children's identities, activity trails, reviews or rankings.
- **Performance**: start with indexed aggregates; introduce a refreshed `ContentDiscoverySnapshot` per type/locale/window only when needed. A cached score cannot bypass current moderation.

An item may appear in both a curated row and an organic ranking row, but each label must describe **why** it is there. Editor-selected is not interchangeable with trending or high-rated.

## Editorial promotion / creator campaigns

Introduce `EditorialFeature` with `id`, a strict `QUIZ|PACK` discriminator, exactly one FK to a quiz or pack, `locale`, `lane`, `placement`, `priority`, `headline`, `description`, `startAt`, `endAt`, `status`, `createdById`, timestamps. Require positive admin intent and audit scheduling/modification/removal.

Admin UI supports search, eligibility preview, one-click feature/unfeature, ordering, optional future start/end, localized spoiler-free copy, and safe covers. Public API returns only currently eligible items; if a featured quiz/pack is hidden, translated content removed, media revoked or safety restricted, it disappears immediately.

A celebrity or expert campaign is just a **curated promotion of actual creator-owned content**, not a special weekly quiz mechanism. Do not label anyone "verified", "expert" or "celebrity" without separately verifiable consent and identity/credential checks. Showing a public creator name + "Editor's Pick" requires no fabricated celebrity status.

## Content and play data changes

Retain existing `Quiz`, `QuizRevision`, `QuizPack`, `PackQuestion`, `QuizPackLocalization` and quiz `Review`. Extend:
- `QuizPack.currentVersion`, optional approved cover reference and `allowShuffle` for editorial pack composition.
- `PlayRun.packId?`, `packVersion?`, `targetCount?` for `PACK` mode and no global five-round finish logic. Keep immutable `PlayRunQuestion(quizId, revisionId, position)` pins.
- `PackReview` keyed by `(packId,authorId,locale)`; pack completion required; independent of quiz ratings.
- `PackReport` for pack-specific moderation.
- `EditorialFeature` for independently managed, audited question-or-pack highlights.
- Optional aggregate ranking snapshots only after measurement validation.

`PACK` play snapshots all published locale-matched question revisions and author order (or approved shuffle) at the start, with entire target count. Authenticated players can resume cross-device; guest progress only where their scoped token is available. Previously seen quiz questions are **allowed in selected packs**; random practice continues to avoid previously seen questions. A 30-question pack completes after question 30; review the pack at the end and optionally the individual questions. Maintain server-side answer grading, original question evaluation and media permissions.

Studio enables single question and full-pack creation, editing, ordering, no-record test play and a single confirmed transactional **publish pack + eligible owned drafts** operation, honoring existing 100 newly published quizzes per rolling 24 hours for non-admins, and the ADMIN exemption. General publication never implies Kids approval. Public sharing uses permanent localized non-spoiler Quiz and Pack URLs with safe Open Graph metadata.

## Weekly Five clean removal / technical impact

The proposed weekly challenge never launched and had no challenge rows or linked runs according to the product owner. The `dev` branch now removes all weekly schema models, API/MCP operations, weekly-only views and reservation logic; the three supported play modes are `RANDOM_FIVE`, `INFINITE` and `PACK`.

`prisma/migrations/20261013040000_remove_unused_weekly_challenges/migration.sql` explicitly checks `WeeklyChallenge`, `WeeklyQuestion`, `WeeklyQuestionLocalization` and all weekly-linked `PlayRun` records. It refuses to drop any weekly objects unless all of those checks are empty. It then removes the unused weekly tables/columns and updates `PlayRun_mode_check` to accept `PACK` and reject `WEEKLY`. Prior migration files remain intact as an immutable migration ledger. Ordinary quiz sessions, random/pack runs, child ownership, media and reviews are left untouched.

## REST/MCP parity

Every new feature uses one shared authorized service behind both REST and MCP:
- `GET /api/v1/discover` → `quizdip_discover`; `GET /api/v1/discover/sections` → `quizdip_discover_sections`.
- Existing `pack_list/create/update` extended; new `GET /packs/:id` → `quizdip_pack_get`, `POST /packs/:id/publish` → `quizdip_pack_publish`.
- Existing `run_start/current/feedback` extended for `PACK`, with durable run token permissions.
- New `GET/POST/DELETE /packs/:id/reviews` → pack-review MCP list/upsert/remove; new pack reports and owner-safe insights receive matching operations.
- Admin `GET/POST /admin/features`, `PATCH/DELETE /admin/features/:id` → `quizdip_admin_feature_list/create/update/remove` with ADMIN enforcement, explicit confirmation, audit and eligibility checks.
- Sharing is a browser-native copy/share of the canonical URL, not a privileged or server-only social action.
- Weekly endpoints/tools are entirely removed from both REST and MCP; any unknown weekly path must return 404 and cannot reach dropped tables.

## Delivery order

**Phase 1: retirement planning + mode engine.** Stop new weekly scheduling carefully, inventory history, make scoring/counts mode-aware and add migrations without deleting data; preserve existing random-five and continuous tests.  
**Phase 2: full quiz-pack creation.** Studio packs, bulk publication, media, safe preview and MCP.  
**Phase 3: full-pack play.** Snapshot, cross-device resume for authenticated users, multi-question completion and pack-specific feedback.  
**Phase 4: Discover dashboard + quality.** Ratings, reports, metrics, ranking fairness, share previews, new and hard content.  
**Phase 5: editorial recommendation + Kids migration.** Admin highlights, celebrity/creator claim policy, native device/time/safety checks and cleanup of legacy weekly UI/API once archives are safe.

Every phase requires migrations/review of existing data, tests, typecheck, build, REST–MCP parity, separate dev/prod state and authorization checks. Implement on `dev`; fast-forward `main` only after explicit user request.

## Acceptance criteria

- 30-question pack published atomically and played to 30, resumed at 13/30, without changing shared quiz ratings or old historic results.
- Discover promotes a mix of *verified* high-rated, popular, difficult, newly published and editorial content with honest sample caveats and separate quiz-vs-pack sentiment.
- Editor can feature a verified eligible quiz or pack at any time; no weekly calendar or requirement to produce precisely five questions; a featured author is not falsely declared a celebrity.
- A newly published low-traffic pack has a path to discovery; abuse cannot easily boost popularity by repetitive session starts.
- No weekly edition or archived weekly history exists. Previously unreserved quizzes remain available for ordinary practice and pack play.
- Kids, language, moderated media, creator ownership, public answer privacy and guest review prevention remain server-enforced across every discovery and play route.
- Every newly exposed UI, REST and MCP function has policy-consistent parity with regression coverage.

**Not in MVP:** paid boosts, fan/celebrity rankings, public child standings, recurring competitions, personalized targeting based on sensitive interests, and automatic claim of verified celebrity identity.

## Discover variety and remix (2026-10-25)

The Discover page now keeps verified popularity, trend, rating and difficulty rankings
distinct from the **unranked rotating surprise selection**. Its qualified candidate
catalog remains bounded for query cost: 100 recently updated quizzes plus up to 60
from an older rotating window; 60 recently updated packs plus up to 40 older.
The UTC-day slot advances automatically, while an explicit remix can advance
the window. The rotation and original ordering never affect play runs, record
comparisons or a pack's question order.

The public `discover_sections` operation accepts an optional integer
`rotation` in 0–1000 (default 0), identically on
`GET /api/v1/discover/sections?locale=...&rotation=...` and the
`quizdip_discover_sections` MCP tool. REST parses `rotation` numerically.
It only affects candidate sampling and the labeled surprise mix; no random item
is ever labeled popular merely for inclusion. Every sample passes the same
language, publication, moderation and approved-media gates. Rankings still
represent verified adult signals *within the bounded candidate sample*, not
an exhaustive global leaderboard.

Featured packs are deliberately mixed across an eligible popular, a recent
and a surprise group when available. Visible discovery lanes exclude featured
and editor-picked cards and each other; when there are insufficient unique
cards, short lanes disappear rather than repeating content. Direct quiz and
pack browsing retain their paginated newest-first behavior and Kids gates.
No schema migration or content rewrite is needed.
