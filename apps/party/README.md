# QuizDip Party — Live party quiz (1–5 players)

QuizDip Party lives at `apps/party` and is a separate Vercel project.
Develop on **dev**; fast-forward **main** only after the user explicitly requests it.

## Live game flow — camera seats and finger votes

1. Choose **Adult** or **Kids** before turning on the webcam. Party downloads ten published four-option QuizDip questions. There are no bundled mock questions; Adult uses Korean/English and Kids uses English Kids-approved content.
2. **Hands-only recognition**: Show up to five separated **open palms** to the camera. A visible hand must first track for at least 800 ms. When all currently visible hands have the four long fingers extended, a visible 2.7-second countdown begins. New hands, tracking loss, or folded fingers reset it, so a late participant can join. Once complete, the count automatically freezes; P1–P5 are assigned by left-to-right order in the mirrored camera preview. Finger count is not identity. A manual Lock players fallback remains available but is not required.
3. The camera lanes are partitioned by midpoints between palm centers and the bottom player panel splits into exactly N equal-width seats. Overlapping or crossing hands do not transfer votes. Lost/reacquired hands require 250 ms of in-lane presence. To change the count, use Rescan players.
4. **Hands-only start**: After locking, keep all the open palms visible in their assigned lanes for another 1.5-second countdown; gameplay starts automatically as soon as questions are loaded. The four long fingers (index through pinky) define an open-palm start gesture, irrespective of thumb misclassification. A manual Start game fallback remains available. Fists are not required; participants never need to walk over to press a button.
5. In each round, show **five fingers for 260 ms to arm** (neutral). The thumb is only consulted when all four long fingers are raised, to distinguish a fully open palm (5, ready) from a tucked-thumb four-finger answer. Fists remain 0 and index-only poses remain 1 regardless of thumb landmark noise. Then **1–4 fingers** selects answer 1–4 with a 360 ms stable pose and a 1-second per-player countdown. A different pose restarts that countdown. This re-arm step prevents the previous round's unchanged hand pose from automatically answering the next question. Players never have to move their hands to the answer tiles or camera bottom.
6. Each seat displays recognized count, own countdown, confirmed answer, tracking status, and score; the answer tile shows colored player markers. Missing/ambiguous hands cannot vote; a loss beyond 350 ms discards an incomplete pose.
7. After everyone votes or the 30-second question timer expires, grading uses the pinned downloaded canonical answers entirely **on-device**. Results show at the end of ten questions. The replay button starts a new set and reopens recognition; no hand movement is needed for replay.

## Data and limitations

The server selects only active, published quiz language revisions; Kids content requires Kids eligibility and approval. QuizDip media URLs are signed per round, not bundled as permanent public URLs. Published canonical answers are downloaded with the local play bundle and graded in the browser. These temporary party scores do not write QuizDip play history or leaderboard records.

MediaPipe detects hand joints, **not permanent person IDs**. Assigned regions guard against common identity swaps, but two hands deliberately sharing a lane, extended occlusion, or crowded five-player camera views may require rescan. Test different devices and lighting before claiming robust five-player support. Video landmarks stay in the browser and are not uploaded.

## Vercel build quota protection

- Only `main` automatically deploys the `quizdip-party` Vercel project. Non-main branches (including `dev`, feature branches, and branches with slashes) are explicitly disabled in `apps/party/vercel.json`.
- Project-level `previewDeploymentsDisabled=true` is also enabled, so preview deployments are not queued from Git updates.
- The ignored-build command permits `VERCEL_GIT_COMMIT_REF=main` (exit code 1) and skips any other branch (exit code 0). This is a fallback guard; ignored builds can still count toward Vercel deployment/build quotas, so the Git branch filter and disabled preview deployments are the primary prevention mechanisms.
- GitHub Actions validation for `dev` is not a Vercel deployment; it remains enabled.
- Keep development changes on `dev` and fast-forward to `main` only after explicit user approval. A push to `main` then deploys both QuizDip and Touch as configured.

## Deployment

- **QuizDip web backend**: `apps/web/app/api/party/route.ts`. Production base is `https://quizdip.com/api/party`; the endpoint must be deployed before the Party UI can load real questions.
- **QuizDip Party**: `apps/party`. Preview testing can set `?partyApi=https%3A%2F%2Fquizdip-...-nomadonghos-projects.vercel.app%2Fapi%2Ftouch` to an authorized QuizDip preview API. Cross-origin preview deployments protected by Vercel Authentication may block browser requests; avoid weakening deployment protection for testing.
- Party CORS only permits QuizDip Party-owned origins, and no credentials are used. Set `PLAY_RUN_SECRET` on the web backend (existing QuizDip server secret). Never copy it into the Touch public client.
- If the web route has not reached production, the Party preview displays a clear loading error rather than returning mock questions.

## Verification

- `node --check apps/party/src/*.js`
- `node --test apps/party/tests/*.test.mjs`
- Root CI: `npm run test`, `npm run typecheck`, `npm run build`.
- Real-world validation must include cross-origin fetch, Korean adult, English adult, English Kids, image-first clues, camera multiplayer, revoked/withdrawn questions, fully offline round grading, and missing language.

The image and text handling is deliberately a one-clue presentation: full progressive clue navigation is not currently included in Touch.

## Rename compatibility

The product is **QuizDip Party** at `https://party.quizdip.com` and the Vercel project is `quizdip-party`. The previous `touch.quizdip.com` domain and `/api/touch` backend endpoint remain compatibility paths. The `touchApi` preview query parameter is accepted alongside canonical `partyApi`. Existing internal touch-named hand engine functions remain untouched to avoid gameplay regressions.

## Central round readiness and visible clock (2026-10-27)

- A fixed **center status station** sits at the intersection of a stable **2-column × 2-row** choice grid: 1/2 on the first row and 3/4 below. The timer and ready indicator remain centered on desktop and mobile without shifting choices when question length, media or readiness changes. On narrow screens, the center station is compact and option labels are pushed toward the outer edges so text stays readable.
- Every new question asks for **five open fingers** again. The station shows how many of the locked players have armed their hands. As soon as all are ready it celebrates **Everyone ready!** for about a second, then switches to a large circular countdown.
- The round clock **still starts at the normal round transition**; no extra hand gate, pause or answer-scoring rule was introduced. The station also shows seconds remaining during readiness. At 5 seconds it turns amber, and at 3 seconds it turns coral with a stronger pulse; low time overrides the readiness prompt so players always see the deadline.
- Player-specific 1–4 finger choice countdowns and confirmation markers are unchanged. All temporary readiness state clears at every new question and replay; a lost hand that requires a new open-palm gesture no longer counts as ready.
- The screen reader announces readiness changes rather than speaking every timer tick. Strong motion effects are disabled with `prefers-reduced-motion`.
- Verification: `node --test apps/party/tests/*.test.mjs` and `node --check apps/party/src/main.js`. Real-device camera timing and small-screen legibility remain manual QA items. This update is developed on `dev`, with `main` reserved for an explicit fast-forward request.
