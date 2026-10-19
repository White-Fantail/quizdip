# Related packs on completed results

The General web pack result screen displays up to three spoiler-safe, locale-specific recommended packs below the result summary, share and review sections. On mobile, cards use a horizontal swipe row; on desktop, a three-column grid. No new recommendation UI is exposed in the Kids native app.

## Ranking and safeguards

The server applies creator-ordered pins first (up to three), followed by deterministic similarity: overlapping title tokens, shared non-spoiler topic IDs, shared member questions, common creator and measured completed plays. A user's completed packs are deprioritized when possible. Guests have no account-history filter. To keep reads bounded, automatic discovery evaluates the latest 120 eligible SQL candidates and separately includes manual picks; it does not claim exhaustive personalized AI recommendations. All returned links pass the same live `safePack` validation as playable pack access: locale, publication, moderation, usable questions and approved media. Restricted/unpublished packs are omitted rather than leaked.

## REST / MCP parity

| REST endpoint | MCP tool | Access |
| --- | --- | --- |
| GET `/api/v1/packs/:id/recommendations?locale=en` | `quizdip_pack_recommendations` | Public, spoiler-safe |
| PUT `/api/v1/packs/:id/recommendations` with `{packIds:[...]}` | `quizdip_pack_recommendations_set` | Pack owner only, 0–3 distinct eligible packs |
| POST `/api/v1/runs/recommendations` | `quizdip_pack_recommendation_track` | Verified completed General pack run capability |

The POST accepts `{runId,runToken,kind:"IMPRESSION"|"CLICK",targetPackIds:[...]}`. Each target must currently be recommended; a CLICK must name exactly one target. `PackRecommendationEvent` has a unique (runId, targetPackId, kind) constraint and inserts ignore duplicates. Therefore owner-only `quizdip_my_pack_insights` (GET `/api/v1/me/packs/:id/insights`) reports card-level recommendationImpressions and recommendationClicks without player-identifying information. This does not prove a subsequent game started.

Creator choices are edited from the Studio pack editor with a separate save button. Updating choices is audited; it does not increment the playable pack version, alter member questions or reset platform-controlled Kids approval.

## Release checks

Migration `20261020100000_pack_recommendations` must be applied to the target environment before these queries are exercised. Run `npm run test`, `npm run typecheck`, `npm run build`, then an authenticated Studio edit, completed guest/signed-in run, repeat-click count check, withheld media/locale negative case, and MCP parity E2E with dev credentials. No successful live verification is implied by source commits.
