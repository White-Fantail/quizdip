# QuizDip (퀴즈딥)

**A little quiz. A lot of fun.**  
단서를 따라, 재미를 발견해.

QuizDip is an open quiz playground where people dip into clue-led games, tackle a weekly five-question challenge, and create and share their own quizzes.

> **Status:** REST API, authenticated Remote MCP adapters, PostgreSQL/Prisma models, migration and shared quiz/play/community services are implemented on `dev`. **Not production-ready:** Google/Apple SSO and MCP OAuth code have been added, but live credentials, Better Auth migrations and end-to-end sign-in have not yet been verified; AI categorization, Kids safety automation, upload storage, and an operational admin console remain future work.

## QuizDip Kids native app (Phases 1–5)

`apps/kids` is the separate Expo/React Native experience for iPad/iOS and Android. The old web Kids game and menu are removed from dev in Phase 5 source. Native onboarding now starts from the adult `/account/kids` settings, with a PIN-only exit for old browser cookies. Production rollout and device QA remain unverified. Shared Kids messages and typed client contracts live in `packages/i18n` and `packages/api-client`. Phase 2 adds one-time PIN-authorized parent-issued codes, OS SecureStore child-only sessions, PIN-protected native exit, guardian-pinned EN/KO and protected approved-quiz discovery. It requires migration `20261012190000_kids_native_pairing`. The parent currently configures profiles and issues pairing codes through the authenticated web panel; Phases 3–4 add source-level guarded games, media clues, private treasures, 10-minute PIN-gated native guardian controls and device-shared daily time limits. Apply migrations `20261012200000_kids_native_play` and `20261012210000_kids_native_parent_time` before native activity. Real device/store checks remain pending; see [release runbook](docs/kids-native-phase4-release.md). Builds, staging migration and actual device E2E are not yet independently verified. See [native setup](apps/kids/README.md) and [migration plan](docs/kids-native-development-plan.md).

## Get started

Node.js 22+ and npm:

```bash
npm install
npm run dev
```

Open http://localhost:3000. To exercise API/MCP, first configure `.env` from `.env.example`, provision PostgreSQL and Google/Apple credentials, run `npm run db:migrate` plus the Better Auth migration described in `docs/auth-sso-mcp.md`. Validation: `npm run test`, `npm run typecheck`, `npm run build`.

## Architecture: one Next.js app, separate responsibilities

```text
apps/
  web/
    app/
      (platform)/        Home, Play, Discover and Kids (public URL paths unchanged)
      (creator)/studio/  Creator Studio UI
      admin/             Protected admin routes and moderation consoles
      api/
        v1/              REST API route handlers
        mcp/             Authenticated stateless MCP endpoint and tool registry
    src/
      modules/           Shared business services for quiz, game, user,
                         moderation, media, analytics and AI
      components/        Reusable UI
      lib/               Shared server infrastructure
packages/
  domain/                Shared pure types and rules for multimodal quizzes
prisma/                  PostgreSQL schema and migrations
docs/                    Architecture, brand, product principles and roadmap
.github/workflows/       CI for dev and main
```

REST and MCP adapters use the same **application service/policy layer** and persistence layer. They are separated in code, not deployed as separate API, admin or MCP servers.

## Current routes

| Path | Behavior |
| --- | --- |
| `/`, `/discover`, `/play` | Public discovery and game experience; live play requires configured backend services |
| `/studio` | Creator entry, media library and weekly proposal UI; full general-purpose editor remains a separate feature |\n| `/account/kids` | Adult guardian profiles, PIN, one-time QuizDip Kids app pairing |
| `/admin/*` | Restricted admin, weekly scheduling and safety review; requires server-side ADMIN checks |
| `/api/health` | Health check |
| `/api/v1/*` | Versioned REST: quizzes, packs, play sessions, reviews, reports, personal metrics and leaderboard |
| `/api/mcp` | Authenticated stateless Streamable HTTP MCP, mirroring API operations |

## Product rules

**문제 제작은 자유롭게. 공개는 즉시. 분류는 자동으로. 노출은 사용자에 맞게. 안전 관리는 지속적으로.**

Creator intent, AI recommended audience/difficulty and platform-managed safety are independent. Only platform-approved, published content may be visible in Kids. The current demo is not a published/approved Kids question.

## Git workflow

- **`dev`** is the active development branch.
- **`main`** is the stable baseline, advanced only on explicit request.
- Use **fast-forward-only** merges (`git merge --ff-only`); no merge commits, squash merges or force pushes.

See [AGENTS.md](AGENTS.md), [product vision](docs/product-principles.md), [clue design](docs/clue-design.md), [content/safety policy](docs/content-policy.md), [creator workflows](docs/creator-workflows.md), [brand](docs/brand.md), [architecture](docs/architecture.md), [development workflow](docs/development-workflow.md) and [roadmap](docs/roadmap.md). The official brand and GitHub repository are **QuizDip** / `White-Fantail/quizdip`; npm workspaces and imports are now consistently `@quizdip/*`; the legacy signed token v1 namespace remains stable for existing-session compatibility.

## API and MCP setup

Read [API–MCP documentation](docs/api-mcp.md) for the parity matrix, security model, configuration and launch gates. All future functional additions require corresponding MCP support; see [AGENTS.md](AGENTS.md). The demo browser UI remains separate from the new persistent platform backend.

## Single sign-on across web and MCP

Google and Apple sign-in are at `/sign-in`. Link additional providers from `/account`, and approve external MCP clients at `/consent`. All browser and ChatGPT identities use one Better Auth user ID. See [SSO and MCP OAuth setup](docs/auth-sso-mcp.md) for provider callback URLs, environment variables, database migrations, security and test requirements. No accounts are silently joined based on matching email addresses.

## Cloudflare R2 media library

The authenticated Studio media library at `/studio/media` uploads image, audio and video directly to a private R2 bucket. Web REST and 36 MCP operations use the same asset IDs and authorization rules. The full API table, required environment variables, R2 CORS and lifecycle configuration, upload fallback for MCP clients, checksums, moderation gates, and end-to-end checklist are in [the Cloudflare R2 media guide](docs/media-r2.md). This code does not provision an R2 bucket or activate public uploads automatically.

## Weekly spotlight and practice play

The main `/play` experience is the **featured creator's same five questions for everyone** in a Monday-to-Monday UTC edition, with separate GENERAL and KIDS audiences. Creators submit five owned quizzes through `/studio/weekly` or REST/MCP; an authorized moderator schedules one per week/lane through `/admin/weekly`. Players choose the weekly, random-five or infinite mode, use server-side progressive clues, and receive question and run scores. The weekly public ranking requires both verified adult status and explicit player opt-in, and is GENERAL only. See [weekly play design, tools and deployment](docs/play-modes.md). Configure `PLAY_RUN_SECRET` and apply the weekly Prisma migration before using these endpoints.

## Trusted safety moderation

Staff can inspect full quiz answers, clues and media via /admin/quiz-review before approving Kids eligibility. REST and MCP share the four ADMIN-only quiz_review_get, quiz_review, media_review_get and media_review operations. This is human moderation, not a live automatic AI classifier.

## QuizDip rebrand rollout

The code and docs use the new brand; connecting `quizdip.com`, configuring production origins/SSO callbacks and replacing any third-party app name or DNS entries are separate deployment steps. MCP operations use the `quizdip_*` prefix. Existing signed session token formats remain unchanged for backward compatibility; local sample names do not rename deployed DB/bucket resources.

## Multilingual foundation (Phase 1)

The web now supports locale-prefixed pages (/en and /ko), UI language selection, a shared typed message catalog, and signed-in locale preferences through REST/MCP. Additive Prisma migration `20261012070000_multilingual_foundation` introduces version-ready localization records with honest `und` legacy classification. Content language filtering, translation workflows and full deep-page copy coverage remain Phase 2/3; do not mistake an English interface for an English-only quiz catalog until then. See [multilingual plan](docs/i18n-foundation.md).

## Strict language filtering (Phase 2)
Public quiz catalog, topic lookup, packs, single-play, random-five, infinite runs and weekly snapshots are now language-scoped on the server for `en` and `ko`. Existing `und` quizzes are intentionally hidden from public language catalogs until their author verifies their true original language via Studio or API/MCP. Supplying a wrong locale does not translate or fallback the content. Apply migration `20261012080000_language_eligible_play` in dev before using this release. See [implementation details](docs/i18n-foundation.md). Remaining UI copy and translation creation are follow-up work.

## Phase 3 translation Studio

Open Studio → My Quiz → Language Versions to draft, AI-suggest (optional), review and publish English/Korean translations without overwriting the original language. Production requires migration `20261012100000_translation_versions`.

## Phase 4 — language-specific reviews and metrics

Ratings and quiz/translation feedback are now language-specific after finished plays. Studio offers per-language result filters. Weekly edition hosts can view per-language private aggregate insights through REST/MCP. Migration `20261012120000_locale_feedback_analytics` must be applied before production use.

## QuizDip Party

The camera-based multiplayer QuizDip game is **QuizDip Party** at `apps/party` (`party.quizdip.com`). It is deployed by the `quizdip-party` Vercel project. The backend provides `/api/party` while preserving `/api/touch` for compatibility. See [Party README](apps/party/README.md). Develop on `dev`; advance `main` only via an explicitly requested fast-forward.
