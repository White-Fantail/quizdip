# QuizDip Touch — Live party quiz (1–5 players)

QuizDip Touch lives at `apps/touch` and is a separate Vercel project.
Develop on **dev**; fast-forward **main** only after the user explicitly requests it.

## Live game flow — camera seats and finger votes

1. Choose **Adult** or **Kids** before turning on the webcam. Touch downloads ten published four-option QuizDip questions. There are no bundled mock questions; Adult uses Korean/English and Kids uses English Kids-approved content.
2. **Recognition phase**: Show 1–5 sufficiently separated hands to the camera. Hand tracking must remain stable for 800 ms; the UI shows the actual detected count. Click **Lock players** to freeze the count and create P1–P5 by left-to-right position in the mirrored preview. Finger count is **not** player identity.
3. Camera lanes are partitioned by the midpoints between the detected palm centers; the on-screen player panel splits into exactly N equal-width seats. A hand moving into someone else's lane is not reassigned while its physical track survives. Ambiguous/overlapping hands cannot vote. After detection loss, recovering a hand requires a 250 ms fresh in-lane observation. Use **Rescan players** to change the count.
4. Starting gesture remains undecided. For now **Start game** is an explicit, accessible button, enabled when the ten questions have loaded and the camera is running. Fist and open-hand start are deliberately **not** used until real-camera testing establishes which is safer.
5. In each round, show **five fingers for 260 ms to arm** (neutral). Then **1–4 fingers** selects answer 1–4 with a 360 ms stable pose and a 1-second per-player countdown. A different pose restarts that countdown. This re-arm step prevents the previous round's unchanged hand pose from automatically answering the next question. Players never have to move their hands to the answer tiles or camera bottom.
6. Each seat displays recognized count, own countdown, confirmed answer, tracking status, and score; the answer tile shows colored player markers. Missing/ambiguous hands cannot vote; a loss beyond 350 ms discards an incomplete pose.
7. After everyone votes or the 30-second question timer expires, grading uses the pinned downloaded canonical answers entirely **on-device**. Results show at the end of ten questions. The replay button starts a new set and reopens recognition; no hand movement is needed for replay.

## Data and limitations

The server selects only active, published quiz language revisions; Kids content requires Kids eligibility and approval. QuizDip media URLs are signed per round, not bundled as permanent public URLs. Published canonical answers are downloaded with the local play bundle and graded in the browser. These temporary party scores do not write QuizDip play history or leaderboard records.

MediaPipe detects hand joints, **not permanent person IDs**. Assigned regions guard against common identity swaps, but two hands deliberately sharing a lane, extended occlusion, or crowded five-player camera views may require rescan. Test different devices and lighting before claiming robust five-player support. Video landmarks stay in the browser and are not uploaded.

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
