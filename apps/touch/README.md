# QuizDip Touch — Live party quiz (1–5 players)

QuizDip Touch lives at `apps/touch` and is a separate Vercel project.
Develop on **dev**; fast-forward **main** only after the user explicitly requests it.

## Live game flow

1. Select **Adult** or **Kids** in a large click/tap card before starting the camera.
2. Touch requests 10 random published multiple-choice questions from QuizDip at `POST /api/touch`, with **four options each**. There are no bundled demo/fallback questions.
3. Adult rounds use the current UI language (Korean/English). Kids rounds explicitly use **English Kids-approved** questions; Korean Kids has no available approved questions at the time of this change. No unapproved translation is substituted.
4. Each player shows 1–5 raised fingers to register. Continue holding the same count during the game. To start, hold each assigned hand inside its own pad for 1.35 seconds.
5. **Keep the entire hand/wrist and assigned finger count visible.** After a brief one-time palm-centre calibration, move the **palm horizontally only** to choose A/B/C/D in one fixed row. No vertical finger pointing, lowered wrist, or fist gesture is required. Hold for 0.4 seconds to arm and 1.0 second to confirm. The palm reference remains fixed for all 10 rounds, even if prompts contain long text or images. If needed, click **Recenter hands** to calibrate again.
6. After everyone answers or the 30-second round timer expires, Touch grades each vote against the downloaded canonical answer entirely offline and displays the result. No network request happens at the scoring step.
7. After all 10 questions, show ranked local results. A single numbered hand can hover over the replay zone for 1.4 seconds or the user can click/tap it, then Touch loads a **new** randomized set from QuizDip.

The server selects only active, published language revisions of active published quizzes. Kids requires Kids eligibility and approval, plus an original/legacy published localization. Image questions must reference READY/APPROVED images in R2. QuizDip question media URLs are signed only when each round is displayed. Unsupported clue types and fewer-than-four-option questions are skipped instead of quietly rewritten.

Touch uses an hour-limited, HMAC-authenticated ticket for the 10 pinned revisions. The initial response includes the authored correct answer as existing QuizDip local play bundles do; Touch grades on the device. The media ticket is used only to request approved image URLs, not to grade. No QuizDip play history or leaderboard record is written by these temporary local multiplayer scores.

## Camera movement and stable visual targets

- Identity is proved with the number of raised fingers; **navigation is driven by the palm centre** (wrist + finger bases), never by the fingertip.
- The start pads and replay zone retain their prior interaction model. During question play, the four choices are laid out horizontally on the same fixed-height row; the question/clue/media have a separate scrollable area if needed and cannot push the answer row down.
- The initial valid palm position becomes player P1–P5's personal neutral x-axis reference after a 420 ms hold. Horizontal motion is measured relative to that reference, so differently positioned people are not required to share a camera centre. Near the camera edge, the movement span is reduced so A/D remain reachable.
- A neutral hand does not vote. A finger-count mismatch or missing hand cannot vote, and moving through empty tile gaps cannot start the dwell timer. Existing per-player dwell countdown and local scoring remain intact.
- The reference and smoothed *normalized* control position persist across the full 10-question game. They are cleared only by a new game, an explicit recenter, or a new audience selection; they are not changed when the screen question/image/choice text changes.
- Real-camera, multi-person ergonomic validation remains necessary after production deployment; deterministic tests alone cannot guarantee MediaPipe tracking in poor light or with a cropped wrist.

## Vercel build quota protection

- Only `main` automatically deploys the `quizdip-touch` Vercel project. Non-main branches (including `dev`, feature branches, and branches with slashes) are explicitly disabled in `apps/touch/vercel.json`.
- Project-level `previewDeploymentsDisabled=true` is also enabled, so preview deployments are not queued from Git updates.
- The ignored-build command permits `VERCEL_GIT_COMMIT_REF=main` (exit code 1) and skips any other branch (exit code 0). This is a fallback guard; ignored builds can still count toward Vercel deployment/build quotas, so the Git branch filter and disabled preview deployments are the primary prevention mechanisms.
- GitHub Actions validation for `dev` is not a Vercel deployment; it remains enabled.
- Keep development changes on `dev` and fast-forward to `main` only after explicit user approval. A push to `main` then deploys both QuizDip and Touch as configured.

## Deployment

- **QuizDip web backend**: `apps/web/app/api/touch/route.ts`. Production base is `https://quizdip.com/api/touch`; the endpoint must be deployed before the Touch UI can load real questions.
- **QuizDip Touch**: `apps/touch`. Preview testing can set `?touchApi=https%3A%2F%2Fquizdip-...-nomadonghos-projects.vercel.app%2Fapi%2Ftouch` to an authorized QuizDip preview API. Cross-origin preview deployments protected by Vercel Authentication may block browser requests; avoid weakening deployment protection for testing.
- Touch CORS only permits QuizDip Touch-owned origins, and no credentials are used. Set `PLAY_RUN_SECRET` on the web backend (existing QuizDip server secret). Never copy it into the Touch public client.
- If the web route has not reached production, the Touch preview displays a clear loading error rather than returning mock questions.

## Verification

- `node --check apps/touch/src/*.js`
- `node --test apps/touch/tests/*.test.mjs`
- Root CI: `npm run test`, `npm run typecheck`, `npm run build`.
- Real-world validation must include cross-origin fetch, Korean adult, English adult, English Kids, image-first clues, camera multiplayer, revoked/withdrawn questions, fully offline round grading, and missing language.

The image and text handling is deliberately a one-clue presentation: full progressive clue navigation is not currently included in Touch.
