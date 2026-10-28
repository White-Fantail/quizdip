# QuizDip Party — Live party quiz (1–5 players)

QuizDip Party lives at `apps/party` and is a separate Vercel project.
Develop on **dev**; fast-forward **main** only after the user explicitly requests it.

## Live game flow — camera seats and finger votes

1. Choose **Adult** or **Kids** before turning on the webcam. Party downloads ten published four-option QuizDip questions. There are no bundled mock questions; Adult uses Korean/English and Kids uses English Kids-approved content.
2. **Hands-only recognition**: Show up to five separated **open palms** to the camera. A visible hand must first track for at least 800 ms. When all currently visible hands have the four long fingers extended, a visible 2.7-second countdown begins. New hands, tracking loss, or folded fingers reset it, so a late participant can join. Once complete, the count automatically freezes; P1–P5 are assigned by left-to-right order in the mirrored camera preview. Finger count is not identity. A manual Lock players fallback remains available but is not required.
3. The camera lanes are partitioned by midpoints between palm centers and the bottom player panel splits into exactly N equal-width seats. Overlapping or crossing hands do not transfer votes. Lost/reacquired hands require 250 ms of in-lane presence. To change the count, use Rescan players.
4. **Hands-only start**: After locking, keep all the open palms visible in their assigned lanes for another 1.5-second countdown; gameplay starts automatically as soon as questions are loaded. The four long fingers (index through pinky) define an open-palm start gesture, irrespective of thumb misclassification. A manual Start game fallback remains available. Fists are not required; participants never need to walk over to press a button.
5. **After the lobby starts the game, keep your hands relaxed while thinking.** A closed fist (**0 fingers**) or open palm (**5 fingers**) held naturally for about 260 ms acts as a neutral/rest pose. To answer, show **1–4 fingers** for a 360 ms stable pose plus a 1-second per-player countdown; a different choice restarts the countdown. After each new question, an unchanged 1–4 finger pose from the previous question cannot automatically vote again: the player must first briefly rest with a fist or open palm. The thumb still distinguishes five from four when all long fingers are extended. Players do not need to move toward the answer tiles.
6. During both live play and answer reveal, each player's panel uses fixed positions: **live finger count in the center** (0–5 or `—` when missing), **tracking status on the left**, and **the submitted choice on the right** (e.g. `제출 2번 ✓`, or `미제출` / countdown before voting). Submission never replaces the live finger count and remains visible after tracking loss. The answer tile shows colored player markers. The tiny live camera-coordinate map alongside the score row shows each verified P1–P5 hand in its assigned lane; unknown/ambiguous hands are marked `?`, never impersonated. If a player is absent for 1 second, the map highlights that lane and reveals the live mirrored local video in the **same reserved space** (no new row and no overlay on the choices). Returning to a valid lane automatically hides the video. The map uses the actual object-fit:contain video bounds, including letterboxing. Missing/ambiguous hands cannot vote; a loss beyond 350 ms discards an incomplete pose.
7. After everyone votes or the 30-second question timer expires, grading uses the pinned downloaded canonical answers entirely **on-device**. Results show at the end of ten questions. The replay button starts a new set and reopens recognition; no hand movement is needed for replay.

## Data and limitations

The server selects only active, published quiz language revisions; Kids content requires Kids eligibility and approval. QuizDip media URLs are signed per round, not bundled as permanent public URLs. Published canonical answers are downloaded with the local play bundle and graded in the browser. These temporary party scores do not write QuizDip play history or leaderboard records.

The lobby camera preview now fits the **actual letterboxed video** and displays a palm-center ring plus five fingertip dots (thumb, index, middle, ring, pinky). Green denotes raised and orange folded; this helps diagnose when the model misreads a finger. Finger counts use the finger's own knuckle axis instead of a strict wrist-distance threshold, improving tolerance for naturally shorter or slightly bent children's fingers. This cannot compensate for fingers hidden from the camera; keep hands apart and move smaller hands nearer the lens. Real-device testing with children's hands remains necessary.

MediaPipe detects hand joints, **not permanent person IDs**. Assigned regions guard against common identity swaps, but two hands deliberately sharing a lane, extended occlusion, or crowded five-player camera views may require rescan. Test different devices and lighting before claiming robust five-player support. Video landmarks stay in the browser and are not uploaded.

## Vercel build quota protection

- Only `main` automatically deploys the `quizdip-party` Vercel project. Non-main branches (including `dev`, feature branches, and branches with slashes) are explicitly disabled in `apps/party/vercel.json`.
- Project-level `previewDeploymentsDisabled=true` is also enabled, so preview deployments are not queued from Git updates.
- The ignored-build command permits `VERCEL_GIT_COMMIT_REF=main` (exit code 1) and skips any other branch (exit code 0). This is a fallback guard; ignored builds can still count toward Vercel deployment/build quotas, so the Git branch filter and disabled preview deployments are the primary prevention mechanisms.
- GitHub Actions validation for `dev` is not a Vercel deployment; it remains enabled.
- Keep development changes on `dev` and fast-forward to `main` only after explicit user approval. A push to `main` then deploys QuizDip and QuizDip Party as configured.

## Deployment

- **QuizDip web backend**: `apps/web/app/api/party/route.ts`. Production base is `https://quizdip.com/api/party`; the endpoint must be deployed before the Party UI can load real questions.
- **QuizDip Party**: `apps/party`. Preview testing can set `?partyApi=https%3A%2F%2Fquizdip-...-nomadonghos-projects.vercel.app%2Fapi%2Ftouch` to an authorized QuizDip preview API. Cross-origin preview deployments protected by Vercel Authentication may block browser requests; avoid weakening deployment protection for testing.
- Party CORS only permits QuizDip Party-owned origins, and no credentials are used. Set `PLAY_RUN_SECRET` on the web backend (existing QuizDip server secret). Never copy it into the Party public client.
- If the web route has not reached production, the Party preview displays a clear loading error rather than returning mock questions.

## Verification

- `node --check apps/party/src/*.js`
- `node --test apps/party/tests/*.test.mjs`
- Root CI: `npm run test`, `npm run typecheck`, `npm run build`.
- Real-world validation must include cross-origin fetch, Korean adult, English adult, English Kids, image-first clues, camera multiplayer, revoked/withdrawn questions, fully offline round grading, and missing language.

The image and text handling is deliberately a one-clue presentation: full progressive clue navigation is not currently included in Party.

## Rename compatibility

The product is **QuizDip Party** at `https://party.quizdip.com` and the Vercel project is `quizdip-party`. The previous `touch.quizdip.com` domain and `/api/touch` backend endpoint remain compatibility paths. The `touchApi` preview query parameter is accepted alongside canonical `partyApi`. Existing internal touch-named hand engine functions remain untouched to avoid gameplay regressions.

## Center countdown and hands-free thinking (2026-10-27)

- The player count and **all palms ready** confirmation happen **only in the lobby** before the first round. Once gameplay begins there is no repeated requirement to keep hands open or show a fresh five-finger pose.
- A fixed status station sits at the intersection of a stable **2-column × 2-row** choice grid (1/2 above, 3/4 below). From the moment each round starts it displays the **remaining seconds**, even if nobody's hand is visible or everybody is resting a fist. At 5 seconds the timer turns amber, and at 3 seconds it turns coral with a stronger pulse.
- To relax or reset between votes, hold a **closed fist (0)** or **open palm (5)** briefly. Each round's vote state resets so unchanged 1–4 fingers carried over from a previous answer are never automatically submitted. Once a player shows 1–4 fingers, that player's existing short hold and 1-second countdown selects the answer.
- The scoreboard distinguishes resting/ready, voting, tracking loss, and confirmed votes without repeatedly requesting open palms. A missing hand cannot cast a new vote. The camera/video stays local to the browser. The countdown and score calculation are unchanged.
- Screen readers announce a warning stage instead of reading every timer tick; strong animations respect `prefers-reduced-motion`. Validate with `node --test apps/party/tests/*.test.mjs`, followed by on-device camera testing.

## Fullscreen play surface, non-overlapping choices (2026-10-27)

When the phase is **playing** or **revealed**, the website header, camera status, language dropdown, source label, and footer disappear. The player still sees question number, answer counts, published prompt/clue/media, four answer cards, the timer, and every participant's current score/vote status. Lobby and results retain their normal controls.

On desktop, answers 1 and 3 are to the left and 2 and 4 to the right of a **reserved, non-overlapping center column** for the clock (top: 1/2; bottom: 3/4). On narrower displays the timer uses its **own middle row** between the top and bottom answer pairs. The timer is in normal grid layout, never absolutely positioned over an answer.

Gameplay uses the visible browser viewport height rather than a 680px/790px fixed minimum, so mobile landscape keeps all four answers and the bottom player board visible without page scrolling. On narrow portrait displays the clock remains in its own row; in short landscape it uses a compact center column. Extra-long prompt/clue text can scroll *inside its panel* rather than moving answers. The Safari browser toolbar cannot be forcibly hidden; `visualViewport` resize/orientation handling responds to its changing visible height. Safe-area padding protects notches and home indicators. Static layout checks are in `apps/party/tests/game-screen.test.mjs`; test on real iPhones and Android phones too.

## Compact hand-recognition lobby (2026-10-27)

Once a game mode is chosen, the pregame **hand-recognition lobby** uses a screen-height-aware layout. The header and instructions are compacted, while the recognized-hand count, automatic open-palm countdown, manual fallbacks, and question-loading/error feedback remain visible. The full, uncropped camera stream occupies a bounded `180–255px` tall panel beside the dynamic 1–5-player board on ordinary desktop screens, rather than letting its 16:9 aspect ratio force the entire page below the fold. Hand tracking and camera resolution are unchanged; only the preview size is adjusted. Narrow/mobile and unusually short desktop viewports fall back to natural page scrolling so neither camera nor controls are cut off. Tests are in `apps/party/tests/lobby-screen.test.mjs`.

## Mobile landscape viewport fit (2026-10-27)

Active rounds now fit the actual `visualViewport.height` on mobile Safari, with `innerHeight` fallback and `viewport-fit=cover` plus safe-area insets. The previous 680/790px minimum board heights are removed. Short landscape (< 641 CSS px) compresses the prompt and image panel, clock and player tiles while keeping the four answers arranged around a dedicated central timer. Oversized prompts remain scrollable *within their own section* rather than pushing answers offscreen. Landscape device and browser-toolbar real-device smoke tests are still required.
