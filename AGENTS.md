# QuizDip AI development instructions

## Required agent reading — source documents consolidated

The project's three 2026-10-11 source materials (product proposal, brand guidelines and architecture framework) are now distributed into these **authoritative, maintained** docs. Read the relevant sections **before** changing the code. Treat future features in these documents as goals, not proof of deployment.

| Concern | Document |
| --- | --- |
| Mission, game types, shared content model, creation philosophy | [Product principles](docs/product-principles.md) |
| Fun clues, gradual evidence, difficulty, multimedia and metrics | [Clue quality](docs/clue-design.md) |
| Creator intent vs AI audience vs trusted safety, General/Kids gates, reports | [Content safety](docs/content-policy.md) |
| Browser Studio and ChatGPT/MCP publishing/editing and confirmation | [Creator workflows](docs/creator-workflows.md) |
| QuizDip name, localization, tone, colors, mascot proposals and navigation | [Brand](docs/brand.md) |
| Next.js/Vercel monolith, shared services, auth, R2, AI and async | [Architecture](docs/architecture.md) |
| dev/main, fast-forward-only, tests and development reports | [Development workflow](docs/development-workflow.md) |
| Feature-specific contracts | [API/MCP](docs/api-mcp.md), [OAuth](docs/auth-sso-mcp.md), [Media](docs/media-r2.md), [Play modes](docs/play-modes.md), [Quiz metadata](docs/quiz-metadata.md), [Roadmap](docs/roadmap.md) |

**Priority:** child safety/privacy and server authorization → product/publication policies → actual schemas, backward compatibility and tested integration → visual and brand proposals. Do not add compulsory creator controls, make Kids approval creator-editable, skip REST/MCP parity or claim planned AI/moderation is live.

## Product and branding
QuizDip is a friendly quiz playground centered on progressive clues and the joy of discovery. External name: **QuizDip (퀴즈딥)**; repository name: `quizdip`. Follow [docs/brand.md](docs/brand.md).

## QuizDip Kids native app (Phases 1–5)
- Native app: `apps/kids` (Expo/React Native) with server-only `apps/web` unchanged. Shared pure `@quizdip/domain`, `@quizdip/i18n`, `@quizdip/api-client` may be used by both; native must NEVER import Prisma, web server modules or server credentials. Downloadable published play bundles intentionally contain approved answer keys.
- Native Kids Phase 1 was a preview shell. Phase 2 adds **source-level** one-time parent PIN pairing and mobile child-session authorization; never claim full deployment or live device success until database migration and real-device tests pass. Gameplay, rewards and daily limits remain Phase 3/4.
- Phase 5 source removes legacy web Kids gameplay/layout/CSS/child activation. Adult bootstrap resides at `/account/kids`; legacy locked browsers require guardian PIN via `/account/kids/legacy-unlock`. Keep Kids moderation, native API, language rules, data and media; there is no Kids weekly lane.

## Native Kids Phase 2 guardrails
- A parent uses a **real Better Auth web session and verified guardian PIN** to issue a short-lived random pairing code; redeeming it returns a child-scoped native token, never adult OAuth cookies or scopes.
- `/api/kids/native` may serve native session/approved catalog and verified PIN exit only; browser `actorFor` and MCP are never authorized by this bearer. Profile language and safety flags are server enforced.
- Apply `20261012190000_kids_native_pairing` to each DB before native pairing. Reinstall/revoke/lockout/rate-limit, iPad and Android smoke tests are mandatory release gates, not implied by unit tests.
- Native pairing credential issue/consume is deliberately an MCP parity exception; document it and keep general REST/MCP gameplay parity.
- First-time app pairing uses a signed-in adult at `/account/kids`, not a web Kids route. Old WEB cookies cannot be auto-cleared because a Better Auth guardian cookie may coexist.

## Architecture
- Implement a **single Next.js modular monolith** on Vercel: public Play/Discover, creator Studio, restricted Admin, REST API and Remote MCP share one deployment.
- Web page, Server Action, REST route and MCP tool adapters must call the **same service/policy layer**. Do not duplicate publishing/safety rules or call internal HTTP endpoints unnecessarily from server code.
- Use `apps/web/app/(platform)` for public UI, `(creator)` for Studio, `admin` for admin pages, `api/v1` for REST and `api/mcp` for remote MCP.
- Business modules live in `apps/web/src/modules`; pure cross-cutting types/helpers in `packages/domain`; Prisma/PostgreSQL schema in `prisma`.
- Admin pages **and admin APIs** must independently enforce server-side ADMIN authorization. Keep admin inaccessible until real authentication exists.
- Real answers and privileged logic must stay server-side; the existing browser sample is a deliberate non-production demo.
- API/MCP and web/MCP SSO are implemented in source. Do not assume deployed or functional until Google/Apple credentials, Better Auth + Prisma migrations, database, build and end-to-end OAuth/E2E are verified. Full AI classification, Kids review automation, and admin console are not yet delivered. Cloudflare R2 upload/media code is not live until credentials and real bucket E2E have been verified.

## Web, social identity, and MCP OAuth (mandatory)
- Use Better Auth's *stable user.id* as the identity for both web browser sessions and MCP OAuth tokens. Do not derive account IDs separately from provider emails or Google/Apple tokens.
- All new auth providers must be wired into `apps/web/src/lib/auth.ts`, sign-in and account-linking UX, and `docs/auth-sso-mcp.md`; they must preserve the same QuizDip account, ownership, reviews and scores.
- Never automatically merge accounts by email. Different Google/Apple identities may be linked **explicitly from an already authenticated account**. Never silently transfer content between two existing Better Auth users.
- MCP requires a resource-bound OAuth 2.1 token for `/api/mcp` validated by `requireMcpAuth`. The web uses Better Auth session cookies. No raw Google/Apple tokens, shared master API keys, or mock identities.
- Keep `/consent`, OAuth discovery and the auth provider migrations tested whenever changing MCP scopes or tool permissions. Every new operation must maintain the REST/MCP feature-parity requirement below.
- Deploy auth tables via Better Auth's migration tooling *and* domain tables via Prisma. Do not connect preview OAuth sessions or DB to production.

## REQUIRED: media parity, ownership and moderation
- All media, whether added by Studio, REST, MCP or AI, must be stored in **private Cloudflare R2** as a first-class `MediaAsset` with an immutable ID; clues and prompts reference `mediaId`/`promptMediaIds`, not arbitrary uncontrolled file URLs.
- Provide both presigned binary uploads and a client-compatible MCP **chunked base64** fallback. Uploaded bytes must be verified server-side for size, SHA-256 and MIME signature before becoming READY. Never treat a staged/expired upload as a validated file.
- On any new media feature or format, update together: Prisma + migration, validated contracts, owner/policy services, REST route, MCP tool, `docs/media-r2.md` and parity tests. Media derivatives must create new assets; never overwrite an existing READY object.
- Never expose pending/restricted media to public players. Public playback requires approved asset and authorized downloaded-game context; Kids requires separate quiz approval. An admin-reviewed asset must not silently become APPROVED after metadata edits or transformations.
- Only allowlisted HTTPS import hosts; defend against SSRF / DNS rebinding / unbounded streaming; preserve attribution/rights metadata. Configure R2 as private, use short-lived signed URLs and expire transient uploads.
- Media upload ticket/URL alone is not proof of success. Test against a real dev Cloudflare bucket, including hash mismatch, unsupported types, expired tickets, unapproved uploads, cross-account access and progressive reveals, before declaring deployed functionality.

## REQUIRED: Discovery-first design and removed Weekly Five
- Follow [Discovery-first platform design](docs/discovery-first-platform-design.md), which supersedes the former weekly-flagship product direction. Quizzes and quiz packs are independent, shareable, reviewable and playable content. Rankings must be based on legitimate qualifying user activity, with separately labeled editorial picks.
- **Weekly Five never launched and is fully removed on `dev`.** No weekly models, run modes, API/MCP routes, scheduled reservations, or admin/creator screens may be reintroduced. Migration `20261013040000_remove_unused_weekly_challenges` aborts if any weekly challenge/question/run data exists, then drops the unused tables and weekly-only `PlayRun` columns. Do not rewrite previously applied migration history; use the new migration for clean removal.
- **Random five is only an optional short introduction**; continuous random play remains available. Full pack play must honor all selected questions, server-side pinned versions, author order and a variable targetCount. Never hard-code currentIndex===4 as a universal finish rule.
- Only trusted ADMIN may select editorial quiz/pack features; endorsement is not proof of popularity or verified celebrity identity. Always enforce current publication, locale, moderation, media and Kids requirements.
- `EditorialFeature` in Prisma is ADMIN-written, audited, and bounded by both `startAt`/`endAt` and current live content validation. Public editorial reads and Kids native editorial reads must never bypass language, media, author attribution or pack safety restrictions. Editorial recommendations are not proof of popular engagement or celebrity/expert verification.
- A `QuizPack` has independent `safetyStatus`/`kidsEligible` gates. ADMIN pack review requires all original-language questions and their media to be approved first. Creator edits revoke Kids approval, but can **never** reset an ADMIN `RESTRICTED` status. Whole-pack public discovery/play/reviews hide RESTRICTED packs.
- Native Kids packs are only available with device Bearer authorization and `requirePlayable` time checks; use `KidPlayRun` profile/device ownership and immutable `PlayRunQuestion` pins. The browser Expo preview must remain SAMPLE-ONLY. Children's play, editorial suggestions, reviews and profiles may never leak into adult/public rankings or analytics.

- Maintain REST/MCP parity, ownership and secure child-device access for every new capability. No content/data deletion or main-branch merge without explicit approval.

## Product and safety
1. Keep creator target intent, AI recommendations/difficulty and platform-controlled safety **independent**.
2. Creators cannot set or override platform safety.
3. Ordinary publishing should be low friction with automatic anti-abuse/safety checks; Kids eligibility requires affirmative platform approval.
4. Preserve multimodal clues and variable game rules; never force the same clue count/scoring onto every mode.
5. Collect minimal children's data. Be accurate and neutral on politics/history.
6. Never claim planned or untested functionality exists.


## Quiz pack moderation

Follow [quiz pack policy](docs/pack-moderation-policy.md): General packs publish immediately and automatically skip unavailable members without deleting membership; only creator-requested packs enter Kids approval, where every quiz and asset must be approved. Creator edits cannot undo independent whole-pack ADMIN restrictions. Pack Kids review and general restrictions are separate. REST/MCP parity, audit trail and migration are mandatory.

## REQUIRED: API + MCP feature parity for every future change
MCP is a full QuizDip product interface, **not just an authoring connector**. Every new capability available through REST, Studio, Play, Discover, user profiles, community, analytics, moderation-status or rankings **MUST also have an appropriately authorized MCP tool**.
- When adding or modifying a feature, update **together**: Prisma schema and migration (when needed), shared service operation, input validation in `apps/web/src/modules/platform/contracts.ts`, REST route mapping, MCP tool exposed by `apps/web/app/api/mcp/route.ts`, `docs/api-mcp.md`, plus relevant unit/integration/parity tests.
- Both interfaces MUST call `execute()` in `apps/web/src/modules/platform/operations.ts` with the same server-enforced access control and business rules. Do not write an MCP-only database implementation or bypass safety, publication, creator ownership, version checks, ranking privacy or spam limits.
- **MCP tool coverage is a release requirement**, not optional follow-up work. If a dangerous/privileged action is deliberately omitted, document precisely why and expose its safe read-only alternative where possible.
- Every agent's change report must state affected REST paths, matching MCP tool names, tests run, and any deliberate parity exceptions. Do not mark a feature done when it lacks its MCP counterpart.
- Only downloadable, approved play bundles may include answers and unrevealed clues (intentionally local-first); never expose draft/restricted/private content. Adults-only public ranking requires separately verified eligibility; Kids exposure requires an affirmative platform safety decision, independent from a creator's age intent.
- Treat publication, bulk edits, sensitive changes and deletions as high-impact and require explicit user authorization/confirmation. Do not let client-supplied safety status or user role override platform policy.
- Keep in mind that exposing a tool is not proof it works: verify production-authenticated MCP invocations and REST parity, not only tools/list.

## Git and validation
1. Work on `dev` by default; do not merge into `main` unless explicitly asked.
2. Integrate changes **fast-forward-only**; no merge commits, squash merges or force pushes.
3. Implement in small steps with tests, typechecking, builds, authorization checks and regression coverage.
4. Keep separate dev/prod secrets and persistence once introduced.

## Moderator play safety release requirement
- The Kids manual review console is /admin/quiz-review. Its read operations quiz_review_get and media_review_get deliberately return sensitive answers and signed unapproved media **only** to authenticated ADMIN; all other public tool routes must keep staged answers and media secret.
- A Kids approval requires all media preapproved, currentVersion optimistic concurrency, explicit confirmation and an auditable decision (written approval notes optional); restricting content requires a substantive reason. Creators cannot approve themselves or override RESTRICTED.

## QuizDip transition safeguards

- QuizDip is the only new customer-facing brand. The repository is `White-Fantail/quizdip`.
- MCP tools use only the canonical `quizdip_*` names; do not register retired-name aliases.
- npm workspaces and imports now use `@quizdip/*`. Existing signed play-token **v1 domains** are compatibility identifiers; keep them stable unless a versioned migration is explicitly designed and tested. Actual provisioned DB names, R2 buckets and external OAuth origins are not changed by editing source or example values. Never expose legacy internal names as public QuizDip branding.
- Branding changes must not loosen publication, permissions, content safety or Kids requirements.

## Kids native Phase 3 trust boundary

- The private `KidPlayRun` / `KidPlaySingle` join models bind run/session ownership to child profile + native device. `getPlaySession` and `checkedRun` must reject child-owned capabilities from ordinary General REST/MCP, even with a correct session token.
- Native gameplay uses the shared local reducer and authorized question-bundle / result-sync endpoints. Legacy server round-trip endpoints remain for compatibility. Only a verified server-internal child actor may resume or mutate a child run. Do not start child runs with adult `User` identity.
- Guard quiz revision, Kids affirmative safety, guardian-pinned locale, published version and each media asset on bundle download and signed media access. Never use unapproved translation/media after a review reset.
- Save child play capabilities only in SecureStore; on approval revocation hide cached content. Child progress/badges stay private. Deleting a child profile clears child-specific play history; no child standings.
- Map coordinates are a placeholder for a native map view. Never call Phase 3 production-ready without migration `20261012200000_kids_native_play`, builds and real-device R2/media/security tests. Retire web Kids only after Phase 4/5 gates.

## Kids native Phase 4 privacy, time and release gates

- Child usage is the server's UTC-minute ledger, unique per child across devices, with guardian-chosen local day. Kids time budgeting is advisory and local to the device; the backend supplies guardian settings and stores activity, without enforcing heartbeat gates.
- The existing `sessionMinutes` is legacy web expiry; native uses separate `dailyMinutes`, `playSessionMinutes`, `breakEveryMinutes`, `timeZone`. A soft break reminder does not replace a server-enforced daily or continuous-session cap.
- In-app guardian control requires short-lived PIN-elevated `KidParentAccess` bound to an active child device and stored only in RAM; it must not authorize general REST/MCP and must be cleared on background. Guardian-controlled deletion/revocation is ownership-checked server-side.
- App store Kids/Families/privacy compliance is **not certified** by static SDK permissions. Publish an accurate privacy policy, configure `CRON_SECRET` and authenticated daily retention cleanup, run real device/security tests, and document proof before rollout.
- Phase 5 moved first-time pairing to `/account/kids` + `/api/account/kids`. The `20261012230000_retire_web_kids_sessions` migration revokes only WEB device tokens but keeps hashed records for PIN exit. Main branch requires explicit request; staging migrations and native device distribution are separately unverified.
- Full verification matrix: `docs/kids-native-phase4-release.md`. Do not claim Phase 4 release readiness or merge `main` without explicit user request.

## QuizDip Party module (2026-10-27)

QuizDip Party source is `apps/party`, the Vercel project is `quizdip-party`, and public hostname is `party.quizdip.com`. Keep `apps/party/vercel.json` main-only build protection and `.github/workflows/party-check.yml`. Canonical REST `/api/party` and compatibility `/api/touch` must maintain the same authorized bundle rules and a restricted CORS allowlist. Do not rewrite stable touch-named internal gesture engines just for branding. Development occurs on `dev`, with `main` updated only via explicitly approved fast-forward.
