# QuizDip Touch — hand-controlled party trivia (phase 1)

Independent static-web game at the proposed touch.quizdip.com domain. The source lives in the existing QuizDip monorepo at apps/touch and should be deployed as its own Vercel project (Framework: Other; Root Directory: apps/touch). This prototype requires no npm install or backend environment variables. Its JavaScript modules are served unbundled by Vercel.

## Implemented
- MediaPipe Hand Landmarker, configured for **up to eight hands**. Camera and landmarks are processed entirely in the browser; only model/WASM files download from Google Storage/jsDelivr.
- Lobby registration by holding a fully open hand in the lower camera field for 0.7 seconds. One hand = one local guest player; body/face recognition is deliberately not used. **Registered open hands stay registered.**
- **No game-start button:** once every registered hand is visibly making a fist continuously for 1 second, the round begins automatically. Any opened, lost, unregistered extra hand cancels the pending start countdown. Camera permission still requires a user click.
- Upper-half question and 2×2 options, lower camera preview. Palm moves up from the lower field to a choice. Choose by holding inside the choice for 0.7s **or closing into a fist for 0.16s**.
- Prevent double vote per player/round, 20-second question clock, reveal screen, speed bonus, eight locally bundled demonstration questions (EN/KO), and results.
- Optional development mouse simulation: /?test=1, including simulated fist readiness.
- Node built-in test suite: node --test apps/touch/tests/*.test.mjs.

## Important constraints and next steps
1. **Eight hands is a configuration target, not eight-people hardware validation.** Generic hand landmarker does not identify which person owns which hand. Registered hand IDs now stay pinned across detector dropouts and attempt spatial re-association. Each participant must use one hand; no guarantees after occlusion/crossing or leaving the frame. Measure real 2/4/6/8 player FPS and ID swap rate on a wide-angle camera. Investigate a registration-zone + motion rejoin protocol before advertising reliable 8-player support.
2. The app currently has **demonstration content and local-only scores**, NOT QuizDip live pack access or official leaderboard scores. QuizDip public quiz_get intentionally does not expose correct answers. Implement a first-party, server-authoritative Touch game session API (published quiz + locale + eligible four-choice options, server-side answer evaluation, pinned pack version), then replace the demonstration adapter. Never ship an answer key in an authenticated/public official scoring client.
3. An independently deployed static frontend still needs explicit cross-origin access design when the QuizDip API is added; do not share Google/BETTER_AUTH secrets in the browser. Guest play first, secure account linking later.
4. Browser needs HTTPS camera permission, model/WASM downloads, adequate lighting, framing for all participants. New device and mobile Safari QA remain necessary.
5. Deployment policy: dev branch changes only, production main must be fast-forwarded upon explicit approval. Touch dev Vercel auto deploy is off by vercel.json.
6. Domain setup is not automatic: attach touch.quizdip.com to the new Vercel project and add the CNAME advised by Vercel at the authoritative domain DNS provider.

## Suggested follow-up
- Structured lobby with registration zones and rejoin/recovery.
- True QuizDip published-pack game API with creator order, server-side score, safety filters and locale/version pinning.
- Device calibration, mirrored camera alignment, 8-hand overlap load tests and accessibility fallbacks.
- QuizDip main-site Touch entry link after the game is QA-ready.


## Tracking/reconnection (2026-10-26)
- Previously, any 1.1-second hand detection gap permanently discarded its track ID. A hand returning from a fist, quick motion or partial occlusion could receive a new unregistered ID and stop interacting. Fixed by pinning registered tracks until the user resets the game.
- MediaPipe GPU acceleration is attempted, falling back to CPU on unsupported devices. Thresholds and inference cadence are tuned for varied hardware; the camera overlay shows inference latency (ms) and recognized hand count to help diagnose performance.
- Association uses predicted motion, hand geometry and optional handedness. A registered hand can rejoin after a temporary loss near its prior position, preserving player score and slot. Hover/selection timers clear when the hand disappears.
- Overlapping hands can genuinely be undetectable by a single camera. If reentry cannot be attributed safely to one player, the game does **not** guess and risk counting another player's vote. Ask players to separate hands and show palms near their prior positions. This remains a real-world testing requirement, especially at 6–8 hands.
- We do not collect or transmit camera video; all inference and local demo scores remain on the device.
