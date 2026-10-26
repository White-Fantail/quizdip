# QuizDip Touch — Finger-number 5-player mode

## Controls
- Up to five players, identified by **finger count**: 1=P1, 2=P2, ... 5=P5. Players show their unique number of fingers steadily for approximately 0.8 seconds in the lower camera area to join. The app does not identify faces or recognize actual people.
- After registration, everyone simultaneously closes their hands into fists and holds them for 1 second to start. An unverified fist cannot join.
- While answering, move your numbered open hand into an answer option, show your number briefly, then **fold to a fist inside the same option** to vote. **Dwell/hover/accidental flyover never votes**. No clicks in the normal camera game.
- After hand overlap, disappear/reappear, or uncertainty, separate the hands and **show the original number of raised fingers again**. The count, not x/y position, restores that slot. No guessing ambiguous identity from a closed fist. Scores and the registered player roster remain stable.
- Finger counting uses MediaPipe 21-landmark hands and a thumb extension check. The hand model is configured for 5 hands. Heavy overlap, unusual palm angles, lighting, and fists can still defeat detection. Hardware validation is essential; digits 1–5 are deliberately user-controlled gestures, not biometric identifiers.
- Results and eight demonstration questions remain local to the device. Full QuizDip pack integration, persisted server-backed results, and 5-player real-device camera certification are future phases.

## Architecture
- Repo: `White-Fantail/quizdip` under `apps/touch`, dedicated Vercel project `quizdip-touch`.
- `src/gestures.js`: count fingers, convert normalized screen positions.
- `src/tracker.js`: ephemeral physical tracks, identity proof via count, explicit uncertainty after overlap, maximum five identities. Never restore identity from an unauthenticated fist after a gap.
- `src/selection.js`: pure state machine; same-choice number pose followed by fist is mandatory.
- `src/game.js`: fixed numeric player slots, votes, game clock and scoring.
- `tests/touch.test.mjs`: identity, occlusion, finger count and no-hover-vote regression tests.
- All image/video processing stays in the browser; the model/wasm load from MediaPipe CDN. HTTPS camera permission is required.
- Develop on `dev`, main fast-forward merge only when explicitly requested. CI: `node --test apps/touch/tests/*.test.mjs` and `node --check apps/touch/src/*.js`.
