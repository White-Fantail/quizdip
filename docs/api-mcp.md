# QuizDip REST API / Remote MCP v1

The web UI, REST API and MCP tools reuse `execute()` and the same policy layer. MCP is a permanent, full-capability interface. The mandatory future feature parity rule lives in `AGENTS.md`.

## Endpoint mapping

| Action | HTTP REST | MCP tool |
| --- | --- | --- |
| Capabilities and schemas, editorial fun rubric | GET /api/v1/catalog | quizdip_catalog |
| Non-blocking pack fun review (owner only) | GET /api/v1/packs/:id/fun-review | quizdip_pack_fun_review |
| Topic discovery | GET /api/v1/topics?q=... | quizdip_topic_list |
| Featured weekly edition and host | GET /api/v1/weekly/current | quizdip_weekly_current |
| Creator's five-question weekly submission | POST /api/v1/weekly/submit | quizdip_weekly_submit |
| ADMIN proposal queue and approved schedule | GET /api/v1/weekly/proposals, POST /api/v1/weekly/:id/publish | quizdip_weekly_proposals / quizdip_weekly_publish |
| ADMIN suspend an edition | POST /api/v1/weekly/:id/suspend | quizdip_weekly_suspend |
| Weekly official first-attempt leaderboard | GET /api/v1/weekly/:id/standings | quizdip_weekly_standings |
| Begin/resume weekly/five random/infinite | POST /api/v1/runs | quizdip_run_start |
| Current question in fixed run | POST /api/v1/runs/:id/current | quizdip_run_current |
| Completed run questions and ratings (requires run token) | POST /api/v1/runs/:id/feedback | quizdip_run_feedback |
| End infinite practice | POST /api/v1/runs/:id/finish | quizdip_run_finish |
| User's run history | GET /api/v1/runs | quizdip_run_history |
| Public ranking user consent | PATCH /api/v1/me/ranking | quizdip_ranking_optin |
| Adult eligibility verification (ADMIN) | POST /api/v1/admin/verify-adult | quizdip_adult_verify |
| Reserve R2 media upload / upload small base64 chunk / seal asset | POST /api/v1/media/upload, POST /api/v1/media/:id/chunk, POST /api/v1/media/:id/complete | quizdip_media_upload / quizdip_media_chunk / quizdip_media_complete |
| Import media by approved HTTPS hostname | POST /api/v1/media/import | quizdip_media_import |
| My media asset library | GET /api/v1/media, GET /api/v1/media/:id | quizdip_media_list / quizdip_media_get |
| Metadata update / confirmed deletion | PATCH /api/v1/media/:id, DELETE /api/v1/media/:id | quizdip_media_update / quizdip_media_delete |
| Image crop/resize | POST /api/v1/media/:id/transform | quizdip_media_transform |
| ADMIN-only media moderation | POST /api/v1/media/:id/review | quizdip_media_review |
| Session-gated signed media URL | POST /api/v1/play/:id/media | quizdip_play_media |
| List public / own / Kids-eligible quizzes | GET /api/v1/quizzes | quizdip_quiz_list |
| Get question (answer only for owner) | GET /api/v1/quizzes/:id | quizdip_quiz_get |
| Clear own rating | DELETE /api/v1/quizzes/:id/reviews | quizdip_review_remove |
| ADMIN list/search/paginate quiz safety queue (including restricted) | GET /api/v1/admin/quizzes/review | quizdip_admin_quiz_review_list |
| ADMIN inspect full quiz and answer | GET /api/v1/quizzes/:id/review | quizdip_quiz_review_get |
| ADMIN independently approve Kids or restrict quiz | POST /api/v1/quizzes/:id/review | quizdip_quiz_review |
| ADMIN inspect media | GET /api/v1/media/:id/review | quizdip_media_review_get |
| Create versioned question | POST /api/v1/quizzes | quizdip_quiz_create |
| Edit with expectedVersion | PATCH /api/v1/quizzes/:id | quizdip_quiz_update |
| Replace clue sequence | PUT /api/v1/quizzes/:id/clues | quizdip_clues_replace |
| Confirm public publication | POST /api/v1/quizzes/:id/publish | quizdip_quiz_publish |
| List/create packs | GET/POST /api/v1/packs | quizdip_pack_list / quizdip_pack_create |
| Update pack and publication | PATCH /api/v1/packs/:id | quizdip_pack_update |
| Start game | POST /api/v1/play | quizdip_play_start |
| Reveal next clue | POST /api/v1/play/:id/clue | quizdip_play_clue |
| Submit answer | POST /api/v1/play/:id/guess | quizdip_play_guess |
| Review unused clues after the signed session ends | POST /api/v1/play/:id/review | quizdip_play_review |
| List/leave reviews | GET/POST /api/v1/quizzes/:id/reviews | quizdip_reviews_list / quizdip_review_upsert |
| Submit report | POST /api/v1/quizzes/:id/reports | quizdip_report_create |
| My reports | GET /api/v1/reports/mine | quizdip_reports_mine |
| Version-scoped success analytics | GET /api/v1/quizzes/:id/stats | quizdip_quiz_stats |
| My profile / searchable, paginated authored questions / statistics | GET /api/v1/me, /me/quizzes, /me/stats | quizdip_me / quizdip_my_quizzes / quizdip_my_stats |
| Owner-only feedback and result summary (all versions), paginated reviews | GET /api/v1/me/quizzes/:id/insights | quizdip_my_quiz_insights |
| Verified adult rankings | GET /api/v1/leaderboard | quizdip_leaderboard |
| Creator's public profile/reputation | GET /api/v1/users/:id | quizdip_user_get |
| Creator's reviews | GET /api/v1/users/:id/reviews | quizdip_creator_reviews_list |
| Review a creator after playing their question | POST /api/v1/users/:id/reviews | quizdip_creator_review_upsert |

Tool arguments are typed by Zod schemas in `apps/web/src/modules/platform/contracts.ts`, and validation also runs for REST. REST uses JSON response envelopes `{ data: ... }`; mutations accept a JSON object body. MCP uses Streamable HTTP at `/api/mcp` (SDK v2, stateless).

## Pack review endpoint changes

- POST /api/v1/packs/:id/kids-request: quizdip_pack_kids_request (creator only; confirm true).
- GET /api/v1/admin/packs/safety: quizdip_admin_pack_safety_list (pending Kids applicants only).
- GET /api/v1/admin/packs/reports: quizdip_admin_pack_reports_list (flagged and restricted packs).
- POST /api/v1/admin/packs/:id/safety-review: quizdip_admin_pack_safety_review. APPROVED and REJECTED determine Kids eligibility; RESTRICTED and RESTORED determine separate general restriction. Reject/restrict require reasons.
- General pack listing and play exclude unavailable questions; Kids requires all members. See [pack policy](pack-moderation-policy.md).

## Content and score semantics

Clues are ordered and stored per immutable `QuizRevision`. Image, audio and video clues use `mediaId`; optional prompt media use `promptMediaIds`. All asset storage is private Cloudflare R2 and documented in [media design and setup](media-r2.md). Each session is pinned to the revision it started on. An authenticated creator can read their answers and complete clue sequence, but public metadata never returns answers; game sessions reveal **one clue at a time** after presenting the random session token. Once the server records `SOLVED` or `FAILED`, `play_review` returns only unused clues of that pinned revision without changing score or run position. It requires the signed session capability, rejects active sessions and honors publication/safety and child-device restrictions. `play_media` can sign approved remaining-clue assets only for completed sessions, even after a multi-question run advances.

User review rating is `+1` or `-1` and requires a completed play. A report is a separate workflow, not a dislike.

**Success rate:** solved / (solved + failed). Active or abandoned games are not counted in the denominator. `quiz_stats.version` selects historic versions; omission selects the current version. The distribution `correctByClueStage` counts solved games at their final clue stage.

**Ranking:** users must have separately verified adult eligibility, set by trusted server-side administration. This defaults to false. Aggregate score takes each user's highest solved score **once per quiz**, not every replay. Account-based ranking excludes anonymous sessions and unverified/child accounts. `my_stats.rank` is null until qualified.

Metadata v2: `mode` is the play mechanic (`progressive-clues`); `answerType` is independent. `topics` replaces categories/tags, and GPT can suggest `recommendedAudience` separately from editable `creatorIntent`. Public topic discovery and filtering always hide spoiler-linked topics. Neither GPT nor a creator can set platform safety. No separate server AI classifier is deployed yet.

General publication doesn't mean Kids approval: pending/unverified content is excluded from Kids mode; creators cannot alter the platform safety fields.

## Operational requirements

The repository contains the API and MCP implementation and Prisma migrations for core, media and weekly play. It adds Better Auth Google/Apple sign-in, account linking, MCP OAuth authorization and consent flows in source, but does not provision live OAuth secrets, PostgreSQL, object storage, AI classifiers or a moderation backoffice.

Before remote access:
1. Follow [Google/Apple SSO and MCP OAuth setup](auth-sso-mcp.md). Configure and migrate development PostgreSQL before production.
2. Configure Google and Apple provider credentials, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `PUBLIC_ORIGIN`. The old `OIDC_ISSUER`/`OIDC_AUDIENCE`/`OIDC_JWKS_URL` configuration has been replaced.
3. Apply both migrations: Prisma domain (`npm run db:migrate`) and Better Auth auth/OAuth tables (`npx auth@1.7.7 migrate --config ./apps/web/src/lib/auth.ts --yes`).
4. Run tests, typecheck and build, then verify signed-in web identity matches MCP `quizdip_me` identity, linking, refresh, consent, account restrictions, Kids and rankings.
5. Before public traffic, enable distributed OAuth and game rate limiting, moderation/abuse automation, adult eligibility checks and verified media storage.

Never treat an MCP tool listed in metadata or a passing typecheck as proof that it is live with an authenticated DB.

## Authentication interface exception

OAuth provider sign-in, linking and unlinking Google/Apple accounts, and interactive third-party consent are **deliberately web-only** user-presence operations at `/sign-in`, `/account` and `/consent`, rather than MCP tools. This prevents an AI agent from silently rebinding the owner's identity or authorizing a new external client. ChatGPT initiates the standard MCP OAuth protocol, which redirects the human to these screens; afterward it uses the verified `quizdip_me` tool to identify the same account. OAuth refresh/revocation are standard authorization-server endpoints, not business-domain MCP tools.


## Language preferences (Phase 1)

| REST | MCP | Meaning |
| --- | --- | --- |
| GET /api/v1/me/locale | quizdip_locale_get | Read signed-in UI/content locale and supported languages |
| PATCH /api/v1/me/locale | quizdip_locale_update | Set both to en or ko atomically |

Public UI routes are /en/... and /ko/... through Next.js proxy rewrites. REST, MCP, auth and OAuth discovery routes remain unprefixed. Phase 1 does not filter content languages, and existing legacy quizzes are stored with the unclassified `und` tag pending Phase 2 classification. Locale tools use the same authenticated service for REST and MCP.

## Phase 2 content language routing
- `GET /quizzes?locale=en|ko`, `GET /quizzes/:id?locale=...`, `GET /topics?locale=...`, `GET /packs?locale=...` require matching published language content. Without `locale`, public read defaults to English for older clients (never substitutes `und`).
- `POST /play {quizId,locale}`; `POST /runs {mode,lane,locale}`; `POST /runs/:id/current {runToken,locale?}` are server-validated and pinned. Front-end uses its URL locale; remote MCP agents must pass the desired content locale explicitly.
- `GET /weekly/current?locale=...` and `GET /weekly/:id/standings?locale=...` apply language-specific snapshot and ranking rules.
- `POST /quizzes/:id/language {locale,confirm:true}` is `quizdip_quiz_language_set`, and `POST /packs/:id/language` is `quizdip_pack_language_set`. These confirm a creator's legacy unclassified ORIGINAL, not translations.
- New question/pack creation accepts `locale: "en"|"ko"|"und"`. Omission remains `und` to avoid false English labeling. Multi-language translation authoring and independent version publishing are Phase 3.

## Phase 3 owned translation endpoints
| REST | MCP | Description |
| --- | --- | --- |
| GET /quizzes/:id/languages?includeContent=true | quizdip_quiz_languages | List versions, optionally editable content |
| GET /quizzes/:id/languages/:locale | quizdip_quiz_translation_get | Read owned editable locale |
| POST /quizzes/:id/languages/:locale/generate | quizdip_quiz_translation_generate | AI suggestion only (requires OPENAI_API_KEY) |
| PUT /quizzes/:id/languages/:locale | quizdip_quiz_translation_save | Save draft: `sourceRevisionId`, `expectedVersion`, `fields` |
| POST /quizzes/:id/languages/:locale/publish | quizdip_quiz_translation_publish | Publish with `expectedVersion`, `reviewed:true`, `confirm:true` |
| POST /quizzes/:id/languages/:locale/hide | quizdip_quiz_translation_hide | Hide with `confirm:true` |

All actions require creator authentication; media identifiers and clue structure must match the source.

| GET /packs/:id/languages | quizdip_pack_languages | List pack languages and completion status |
| PUT /packs/:id/languages/:locale | quizdip_pack_translation_upsert | Save translated pack `title`, `description`, optional `sections` (`start`, `title`, `description`), `closingMessage`, `scoreReviews` (`minimumScore`, `title`, `description`); publish with `confirm:true` when every question and story text is complete |

Pack language versions store their own chapter copy, ending and score reviews. Chapter `start` boundaries, source media references and score `minimumScore` thresholds must match the original; translation inputs cannot replace media or restructure score bands. Existing older language records without these fields use language-specific generic part labels and omit untranslated ending/score text rather than exposing English content in a Korean session. `quizdip_pack_languages` returns the editable localized fields for the owner. The matching REST operation uses the same service and validation; the creator pack detail screen provides the same editor. Migration `20261018194000_pack_full_localizations` adds the fields and completes the Korean Elon Musk pack copy.


## Phase 4 — reactions & analytics
| REST | MCP | New behavior |
| --- | --- | --- |
| POST/DELETE /quizzes/:id/reviews | quizdip_review_upsert / quizdip_review_remove | `locale` and `kind` (QUIZ or TRANSLATION), requires completed play in language |
| GET /quizzes/:id/reviews?locale=ko&kind=QUIZ | quizdip_reviews_list | Locale-specific review list |
| GET /quizzes/:id/stats?locale=ko&version=1 | quizdip_quiz_stats | Per-language revision statistics |
| GET /me/quizzes/:id/insights?locale=ko | quizdip_my_quiz_insights | Owner-only localized stats; `locale=all` combined |
| GET /weekly/:id/insights?locale=all | quizdip_weekly_insights | Host/admin-only anonymized weekly summary |

## Native Kids protected pairing (Phase 2)

The parent action `POST /api/account/kids` `{action:"native_pair_issue",profileId,pin}` requires an existing same-origin Better Auth browser session, ownership of the child profile and the six-digit guardian PIN. It issues a short-lived one-use random code without returning a device credential to the browser. Its code hash is stored in `KidPairTicket` and redeemed atomically.

The separate `/api/kids/native` endpoint supports:
- `POST {action:"pair",code,deviceName}` → scoped native bearer device credential, returned once;
- `GET ?view=session` (Bearer) → profile's pinned locale and expiry;
- `GET ?view=catalog` (Bearer) → `quiz_list` shared operation with forced `kids:true` and guardian-selected locale, never a client-supplied audience;
- `POST {action:"unlock",pin}` (Bearer) → verify guardian PIN and revoke credential.

These endpoints are **deliberate REST/MCP parity exceptions**: creating/exchanging a device bearer capability, confirming/ending a child-only device session and verifying guardian PIN must not be exposed to external MCP agents. There is no safe read-only tool that reveals a child bearer, pairing code or PIN. Already-existing quiz listing and Kids moderation continue to use common REST/MCP `execute` operations with server authorization. Native bearer tokens **never** authenticate general web REST, Studio, Admin or MCP.

Migration: `20261012190000_kids_native_pairing`, preserving old `clientKind=WEB` sessions. A mobile app is not production-ready until migrated Postgres, actual Better Auth login, guardian PIN lockout, cross-device revocation, real iPad/Android, token expiry, restore/reinstall and locale/content approvals pass E2E. This feature does not expose child progress or new gameplay operations (Phase 3).

## Native Kids play (Phase 3)

`POST /api/kids/native/play` requires the child-only Bearer credential from a previously paired guardian device, with strict body action schemas: `run_start` (`RANDOM_FIVE` or `WEEKLY` only, always KIDS lane), `run_current`, `single_start`, `single_current`, `clue`, `guess` and `media`. `GET ?view=treasures` returns private per-profile progress and earned badges. None of these accepts a client-supplied profileId, guardianId, lane, locale or grading outcome. The API is not a new player/creator identity or public leaderboard.

Core `getPlaySession` and `checkedRun` deny ordinary browser REST/MCP capabilities for child-owned runs, even when run/session capability tokens are supplied: a verified native child scope matching both profileId and deviceId is also necessary. Shared grading, public eligible content, version-pinning and signed media checks remain in the existing server engine; `/api/kids/native/play` is a deliberately restricted child-device wrapper rather than a second grading implementation.

Migration `20261012200000_kids_native_play`; carry out DB backup, migration, tests and staged release before enabling native live play. The native capability provisioning, child play execution, PIN gates and private reward data are intentionally **not available as Remote MCP operations**: MCP cannot supply a verified child-device OS credential. General creator quiz review, normal adult play and public discovery retain their existing REST/MCP parity.

## Guardian management and authoritative time (Phase 4)

`POST /api/kids/native/parent` with `{action:"authorize",pin}` exchanges verified guardian PIN + **active child device bearer** for a separate device-bound 10-minute parent token. `GET /api/kids/native/parent` and subsequent strict POST profile/device/history actions require both `Authorization: Bearer <child-device-token>` and `X-Kids-Parent: Bearer <parent-token>`. The parent token is hashed at rest and held only in React memory, cleared when the app goes to background; it cannot authenticate ordinary REST/MCP. PIN change revokes paired devices. This is an intentional MCP parity exception for sensitive guardian/device secrets; normal quiz creation, public content and trusted moderation keep their existing shared-operation parity.

`POST /api/kids/native/time` with child bearer and exactly `{action:"heartbeat"}` records one authoritative UTC minute per child across devices and returns remaining time and session minutes; `GET /api/kids/native/time` is read-only. Client clock, timezone and duration are never accepted. Timezone is the guardian-verified profile setting. The `KidUsageMinute` unique key plus serializable transaction and retry prevent double charging simultaneous devices. Child catalog, play, R2 media and private treasures check budget and a recent heartbeat. A 10-minute rest follows a maximum continuous-play session. Never confuse the independent legacy web `sessionMinutes` with the new `dailyMinutes` and `playSessionMinutes`.

Retention: `GET /api/internal/kids-retention` accepts only a 32+ character `CRON_SECRET` bearer, removes 90-day old usage minutes and expired parent/pair credentials; configure a private **daily scheduler** before going live. See `docs/kids-native-phase4-release.md` for full staging/production rollout and explicit unverified release gates.

### Child safety reports and parent audit

Native `POST /api/kids/native/play` `{action:"report",quizId,reason:"UNSAFE"|"INCORRECT"|"BROKEN_MEDIA"}` requires a valid child device and a previously played quiz owned by the same profile. The rate of duplicate reports is bounded by a unique profile/quiz/reason constraint; no child comment field is collected. This action is intentionally permitted even during an exhausted play-time budget so a safety flag is not suppressed. The existing ADMIN-only shared `quiz_review_get` operation adds `childSafetySignals` as reason/count aggregates **without** profile or device identifiers, retaining REST/MCP parity for moderation. Guardian management writes action-only `AuditLog` events without child nicknames or PIN inputs.

Migration `20261012220000_kids_safety_reports` is required after the Phase 4 parent/time migration.

## Phase 5 — web Kids retirement (dev source)

A signed-in guardian manages first native pairing in the **adult account** `/account/kids` using `GET/POST /api/account/kids` with same-origin checks. The old web Kids React/Next routes, navigation, CSS, `/api/kids/device` and `/api/kids/parent` are removed. Retired `/kids/**` paths 307 to adult setup, not browser gameplay. Expo's pairing URL uses `/account/kids`.

Existing browser `quizdip-kid-session` cookies remain fail-closed until verified guardian PIN via `POST /api/account/kids/legacy-unlock`. This limited recovery route never returns a child game or adult login; only a validated WEB device token hash and correct guardian PIN allow cookie expiration. This is intentional child-privacy REST/MCP parity exception. Migration `20261012230000_retire_web_kids_sessions` revokes WEB-only rows while retaining their hashes so PIN release works after revocation, and leaves NATIVE rows intact. See `docs/kids-native-phase5-cutover.md` for rollout, E2E and backup gates.

## Moderator approval notes (October 2026)

For `quizdip_quiz_review`, `quizdip_media_review` and `quizdip_admin_pack_safety_review`, `reason` is optional for approval and defaults to an empty string. Restricting a quiz or media requires at least 5 non-whitespace characters; restricting a pack requires at least 8. All decisions still require `confirm:true` and authenticated ADMIN authority, and the audit log records the decision even if its approval note is blank. The same rule is enforced in REST and MCP because both use the shared operation contracts. The separate administrator queue supports `limit`, `offset`, `safety` and `search` and never uses public discovery filtering.

## Adult rankings (daily / weekly / monthly)
- `GET /api/v1/leaderboard?period=week&category=solved&limit=20&offset=0` ↔ `quizdip_leaderboard`. `period`: `day|week|month|all` (default `all` for legacy clients). `category`: `solved|detective|challenge|explorer|rising` (default `solved`). Optional `quizId` retains per-quiz lookups. Return rank, score, distinct solves, category value, UTC boundaries and scoring basis.
- `GET /api/v1/me/stats` ↔ `quizdip_my_stats` provides private all-time history plus `periodStats` (UTC day/week/month/all), personal weekly and all-time eligible rank. Personal history remains private regardless of ranking visibility.
- `PATCH /api/v1/me/ranking` ↔ `quizdip_ranking_optin` remains the audited, confirm-required user consent; `quizdip_adult_verify` separately controls trusted staff adult eligibility.
- Eligibility: authenticated GENERAL play, first completion per user/quiz/UTC period (including wrong first completions), no authored/self plays, child device or KidPlaySingle history, restricted/unpublished quizzes, guests, or non-consenting/non-verified public identities.
- Detective: average successful score among quizzes with at least two clues and five qualifying solves. Explorer: at least two separate successful quizzes per non-spoiler primary topic; fallback to answer type when absent. Challenge: qualified solves weighted by all-time failure percentage with at least 10 distinct registered completions and ≥40% failure, without revealing identities. Rising: accounts created within 30 days; high solver count in the selected period.
- Public GET queries use bounded server aggregation and fail closed if an accurate full ranking exceeds the current live limits rather than reporting a partial list as complete. UTC daily/week/month boundaries use Monday as week start. No weekly challenge mode, prizes or Kids leaderboards are introduced.

## Authored multiple-choice answers (backward-compatible)

The existing `answer` object keeps `canonical` and `aliases`. Question create/update and manually translated drafts may optionally add `responseMode:"multiple-choice"` and `options` (2–6 distinct strings containing the canonical answer exactly once). All other options are incorrect and must not overlap aliases, including case/Unicode-normalized variants. No new Prisma columns or migration are necessary: versioned answers are already JSON. Omitted `responseMode` continues to mean free-text.

Example authoring payload fragment:

```json
{
  "answer": {
    "canonical": "Tyrannosaurus",
    "aliases": ["T-Rex"],
    "responseMode": "multiple-choice",
    "options": ["Triceratops", "Tyrannosaurus", "Stegosaurus", "Brachiosaurus"]
  }
}
```

On `play_start`/`run_current`, the server returns `responseMode` and, for authored multiple-choice only, shuffled `options`. The order remains stable for a resumed session but varies across sessions. `play_guess` still accepts `guess` as a string, and multiple-choice guesses must match a supplied choice. The server grades without exposing which choice is correct. Explicit multiple-choice gets 75% of the free-text clue-based score (75 points maximum). Existing play records and legacy question scores remain unchanged.

Kids native play prioritizes authored choices for every age group. For legacy free-text questions the existing age-dependent, approved-question decoy generator remains in use. Translations must preserve the answer mode and choice count; AI translation includes translated distractors and remains reviewable. Altering an approved question still creates a revision subject to Kids review. All authoring changes use existing REST/MCP operations and shared validation, with no new operation or permission.

## Configurable report moderation (non-AI, dev implementation)

The following ADMIN-only operations use the same authenticated `execute()` service for REST and MCP:

| REST | MCP | Action |
| --- | --- | --- |
| GET /api/v1/admin/moderation/policy | quizdip_admin_moderation_policy_get | Inspect current report thresholds and anti-brigading settings |
| PATCH /api/v1/admin/moderation/policy | quizdip_admin_moderation_policy_update | Update thresholds, established-user minimum and window; `confirm:true` |
| GET /api/v1/admin/moderation/queue | quizdip_admin_moderation_queue | Quizzes and packs held for staff review or with open reports |
| POST /api/v1/admin/moderation/review | quizdip_admin_moderation_review | Clear, restrict or restore a reported QUIZ/PACK; `confirm:true` |
| GET /api/v1/admin/moderation/publishers/:userId | quizdip_admin_publisher_get | Inspect current account publishing access |
| POST /api/v1/admin/moderation/publishers/:userId | quizdip_admin_publisher_set | Apply/lift timed or indefinite publishing restriction with reason, `confirm:true` |

Existing `POST /api/v1/quizzes/:id/reports` / `quizdip_report_create` and `POST /api/v1/packs/:id/reports` / `quizdip_pack_report_create` now evaluate the current persisted policy after every eligible adult report. A qualifying report count changes `safetyStatus` from `ACTIVE` to `UNDER_REVIEW` and does **not** change `publication`. The `ACTIVE` gate applies to public catalogs, detail, ratings, discovery, Kids, runs and signed sessions. Staff resolves open reports and logs decisions; creator publishing restrictions gate REST, Studio and MCP publication operations.

Threshold defaults and reviewer safeguards are defined in [report moderation design](report-moderation.md). No AI classifier is used. Production rollout requires database migration `20261014080000_report_moderation` and tested account-authenticated flows.

### Creator notices and appeals (no AI)
| REST | MCP | Purpose |
| --- | --- | --- |
| GET /api/v1/me/moderation | quizdip_my_moderation_inbox | Owner-only recent notices, account publishing status and appeals |
| POST /api/v1/me/moderation/notices/:id/read | quizdip_my_moderation_read | Mark an owned notice as read |
| POST /api/v1/me/moderation/appeals | quizdip_my_moderation_appeal | Appeal own held/restricted QUIZ/PACK or publisher restriction |
| GET /api/v1/admin/moderation/detail/:kind/:id | quizdip_admin_moderation_detail | ADMIN full reasons, audit and related appeals |
| GET /api/v1/admin/moderation/appeals | quizdip_admin_moderation_appeals | ADMIN appeal queue |
| POST /api/v1/admin/moderation/appeals/:id/review | quizdip_admin_moderation_appeal_review | ADMIN accept/reject and explain decision |

These endpoints use owner/admin authorization in shared platform operations. They depend on migration `20261014100000_moderation_appeals_and_notifications`; the prior migration `20261014080000_report_moderation` is also required. Alert messages intentionally omit the reporter identity. Staff decisions are audited. Changing thresholds re-evaluates existing OPEN reports; disabling auto holds does not auto-restore previously withheld material.

## Shared non-blocking fun rubric

All quiz/pack authoring tools advertise `quizdip_catalog.funQuality` (five weighted editorial criteria totaling 100). Pack create/update, preflight and publish preview return a `funReview` payload; GET `/api/v1/packs/:id/fun-review` / `quizdip_pack_fun_review` returns that review without saving anything. The service enforces pack ownership and uses only the current owner's localized draft revisions or other authors' publicly published versions. The review reports objective signals (missing opening/ending, explanation coverage, duplicate prompts and thin multiple-choice distractors) and suggested revisions. It intentionally returns `score: null` because metadata rules cannot judge humor, surprise, fairness or narrative quality; editorial/AI interpretation is necessary. Suggestions **never** block ordinary publication, alter safety status, or substitute for factual/source validation.

## Related-pack recommendations

- `quizdip_pack_recommendations` ⇄ GET `/api/v1/packs/:id/recommendations`: public, spoiler-safe, locale-specific up to three currently playable packs.
- `quizdip_pack_recommendations_set` ⇄ PUT `/api/v1/packs/:id/recommendations`: owner-only manual ordered picks; no Kids approval changes.
- `quizdip_pack_recommendation_track` ⇄ POST `/api/v1/runs/recommendations`: idempotent recommendation impressions/clicks from a verified completed General run, with run capability.
- `quizdip_my_pack_insights` ⇄ GET `/api/v1/me/packs/:id/insights`: includes anonymized recommendation impressions and clicks.

See [result recommendations](pack-recommendations.md) for scoring and verification.
