# QuizDip Touch — Live party quiz (1–5 players)

QuizDip Touch lives at `apps/touch` and is a separate Vercel project.
Develop on **dev**; fast-forward **main** only after the user explicitly requests it.

## Live game flow

1. Select **Adult** or **Kids** in a large click/tap card before starting the camera.
2. Touch requests 10 random published multiple-choice questions from QuizDip at `POST /api/touch`, with **four options each**. There are no bundled demo/fallback questions.
3. Adult rounds use the current UI language (Korean/English). Kids rounds explicitly use **English Kids-approved** questions; Korean Kids has no available approved questions at the time of this change. No unapproved translation is substituted.
4. Each player shows 1–5 raised fingers to register. Continue holding the same count during the game. To start, hold each assigned hand inside its own pad for 1.35 seconds.
5. Move the centroid of the raised fingertips over a choice. Stay for 0.4 seconds to arm plus 1.0 second countdown to select; do not form a fist.
6. At all responses or after the 30-second round timer, Touch calls QuizDip server grading, then displays the correct answer and awards local points. A temporary grading outage retries, never fabricates a correct answer.
7. After all 10 questions, show ranked local results. A single numbered hand can hover over the replay zone for 1.4 seconds or the user can click/tap it, then Touch loads a **new** randomized set from QuizDip.

The server selects only active, published language revisions of active published quizzes. Kids requires Kids eligibility and approval, plus an original/legacy published localization. Image questions must reference READY/APPROVED images in R2. QuizDip question media URLs are signed only when each round is displayed. Unsupported clue types and fewer-than-four-option questions are skipped instead of quietly rewritten.

Touch uses an hour-limited, HMAC-authenticated ticket for the 10 pinned revisions. The initial response does **not** expose the correct choice. The server grades each round after submission; the URL never includes the answer key. No QuizDip play history or leaderboard record is written by these temporary local multiplayer scores.

## Deployment

- **QuizDip web backend**: `apps/web/app/api/touch/route.ts`. Production base is `https://quizdip.com/api/touch`; the endpoint must be deployed before the Touch UI can load real questions.
- **QuizDip Touch**: `apps/touch`. Preview testing can set `?touchApi=https%3A%2F%2Fquizdip-...-nomadonghos-projects.vercel.app%2Fapi%2Ftouch` to an authorized QuizDip preview API. Cross-origin preview deployments protected by Vercel Authentication may block browser requests; avoid weakening deployment protection for testing.
- Touch CORS only permits QuizDip Touch-owned origins, and no credentials are used. Set `PLAY_RUN_SECRET` on the web backend (existing QuizDip server secret). Never copy it into the Touch public client.
- If the web route has not reached production, the Touch preview displays a clear loading error rather than returning mock questions.

## Verification

- `node --check apps/touch/src/*.js`
- `node --test apps/touch/tests/*.test.mjs`
- Root CI: `npm run test`, `npm run typecheck`, `npm run build`.
- Real-world validation must include cross-origin fetch, Korean adult, English adult, English Kids, image-first clues, camera multiplayer, revoked/withdrawn questions, temporary offline grading, and missing language.

The image and text handling is deliberately a one-clue presentation: full progressive clue navigation is not currently included in Touch.
