# QuizDip — authoring via Studio and ChatGPT/MCP

The platform supports **two** authoring paths, built on one schema, ownership model, audit policy and service layer.

## Default editorial fun review (Studio, REST and MCP)

Every creator receives the same optional **five-criterion, 100-point editorial rubric** in `quizdip_catalog.funQuality`. MCP `quizdip_quiz_create`, `quizdip_quiz_update`, `quizdip_pack_create` and `quizdip_pack_update` explicitly point authoring agents to this rubric. The five review weights are: opening hook (20), factual surprise/discovery (25), fair/appealing answers (15), pacing/variety (20), and satisfying ending (20). The agent or human should review drafts and revise weak sections before publication. Factual accuracy, accessibility and Kids safety take priority over entertainment.

Creating/updating packs, running `quizdip_pack_preflight` or `quizdip_pack_publish_preview` automatically returns an owner-only **`funReview`** with observable metrics and non-blocking improvement suggestions. `quizdip_pack_fun_review` (GET `/api/v1/packs/:id/fun-review`) makes the same read-only review available on demand. An agent can use the five criteria to judge creative quality; the server never invents a numeric fun score from metadata, calls unscheduled AI, changes questions, blocks publication or treats advice as moderation. MCP clients may ignore tool descriptions, so compliance with qualitative self-review cannot be guaranteed by the protocol alone.

## ChatGPT + Remote MCP

Example: “초등학생을 위한 공룡 맞히기 퀴즈 10개 만들어줘. 사진과 소리 단서를 쓰고 뒤로 갈수록 쉬워지게 해줘.”

1. Look up supported game formats, clue/media types and required fields.
2. Generate Question, Answer (including acceptable aliases), ordered Clues, and media ideas or validated references.
3. Infer initial category, difficulty and recommended audience; respect the creator's desired audience and optional corrections.
4. Offer a readable/playable preview; let the creator rewrite, reorder, replace or delete a clue and adjust answers.
5. Authenticate the **actual owner** using MCP user OAuth. Require user confirmation before publishing or significant/bulk modifications.
6. Persist via shared service operations, not MCP-only database writes. Display publication and Kids eligibility separately.
7. Allow later retrieval, pack creation, edits, aggregate quality feedback and AI revision proposals.

## Browser Studio

Support direct manual creation even when AI is unavailable. Minimize mandatory configuration. Put age-intent, categorization, advanced reveal settings and media options behind optional controls. Editing, preview, revision history, publication and creator metrics should remain easy and transparent.

## Engineering obligations

Studio, REST and MCP must use identical domain checks for ownership, publishing, Kids gates, versioning and quotas. This repository also requires **product-wide REST/MCP operation parity** (not only authoring tools), or a documented safety exception. New operations update service, validation, REST, MCP, tests and docs together. An AI-generated instruction or uploaded quiz is **untrusted input**, never a privileged command. Do not bulk-publish on an AI agent's initiative or claim a saved/approved result that the server did not confirm.

See [product principles](product-principles.md), [content policy](content-policy.md), [API/MCP](api-mcp.md) and [auth](auth-sso-mcp.md).

## Quiz creation and publication quotas

Quiz creation has no per-account daily quota. A non-admin creator may publish up to **100 new questions in any rolling 24-hour period**; users whose trusted server-side role is exactly `ADMIN` are exempt from this publication count. The exception applies only to the count, not confirmation, quiz ownership, media validation, restricted-content blocks, moderation/independent Kids approval, or publication audit logs. Studio, REST, and MCP all share the same server-side enforcement.

## Existing Studio management UI

The authenticated `/studio` lists only the signed-in creator's questions, with server-side 20-item pagination, title/question search (including past revisions), publication and moderation filters. `/studio/quizzes/:quizId` provides a versioned metadata editor and private owner-only aggregate play results plus 10-item paginated reviews. Analytics cover all revisions; rates exclude unfinished sessions. Report reasons are aggregated, not raw report texts or reporter identities. The UI reuses REST `my_quizzes`, `my_quiz_insights`, `quiz_get`, `quiz_update`, and confirmed `quiz_publish`; the corresponding tools are auto-registered through the same MCP operations registry. Publication and Kids approval stay separate; metadata edits create a new immutable revision and reset moderation/Kids eligibility. Full answer/clue visual editing remains a future Studio task (already supported through REST/MCP).

## Studio test play (owner preview, no records)

From the creator's quiz list or management screen, open `/studio/quizzes/:quizId/preview` (Test play). This route requires a signed-in **author** and checks `quiz.authorId` server-side, even for an otherwise public quiz. It supports the current saved revision in DRAFT, PUBLISHED and HIDDEN states, including pending/unapproved media. It does **not** grant public or Kids eligibility and does not display unsaved metadata form changes.

The client renders the same progressive-clue and rich media layout as the regular single-quiz player. It simulates guesses and answer checking with the shared pure `@quizdip/domain` helpers, without invoking `play_start`, `play_clue`, `play_guess`, reviews, rankings, or analytics. **No PlaySession is created and no result, attempt, rating or score is persisted.** Preview media is fetched through existing **owner-only** `media_get` signed URLs at reveal time (including pending items). Media URLs expire after 60 seconds; restarting the preview refreshes them.

This is intentionally a UI composition of existing `quiz_get` + `media_get` operations, both already exposed through REST and MCP with the same authorization. No new REST operation or MCP tool is required. Re-test media playback, draft access and no-write behavior against deployed auth and R2 before claiming end-to-end release readiness.
