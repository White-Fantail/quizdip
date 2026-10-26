# QuizDip Touch — stable-fingers party quiz (up to 5 players)

QuizDip Touch lives in White-Fantail/quizdip at apps/touch, deployed as a separate Vercel project. Develop on dev; merge main with fast-forward only when requested.

## Controls (no fists required)
- Register by showing 1–5 fingers for approximately 0.8 seconds; fixed finger count is your player number (P1–P5). Keep that same number throughout the game. After overlap, show the number again.
- **Start:** Each registered player moves their numbered hand into their own horizontally separated, color-coded start pad and holds it for 1.35 seconds. All active player pads must be ready simultaneously to start. Moving away, changing count or losing tracking resets the affected pad. No fist or group overlap.
- **Answer:** Hold a numbered hand over a choice for 0.4 seconds to arm, then a further 1.0 second while the circular countdown appears at that player's position (1.4 seconds total). The colored countdown pin shows the player number and remaining seconds, then changes to 'P2 ✓'. A colored badge remains on the choice. Every player has an independent countdown and may vote once.
- Exiting the choice, changing number, disappearing or camera stall cancels the pending countdown. Hovering briefly or crossing a card never votes.
- Each round lasts 30 seconds.

## Implementation
- The lobby displays five spaced start pads to reduce hand overlap; camera and scoreboard remain below the question or pads.
- Per-player color, number and progress ring distinguish countdowns, including simultaneous selection of the same option. No need to distinguish by color alone.
- gestures.js and tracker.js identify only raised-finger counts, not biological identities. Overlapping hands or bad lighting may still cause temporary loss; the game refuses mismatched counts rather than assigning someone else's points.
- start-zones.js is the pure start-pad state machine; selection.js is the pure two-stage dwell state machine; main.js renders colored progress pins and per-choice confirmation markers.
- Test using node --test apps/touch/tests/*.test.mjs and node --check apps/touch/src/*.js.
- Camera uses MediaPipe locally; no video upload. Browser camera permission still requires a click. The mouse-only test mode is /?test=1.

## Remaining limitations
The app uses eight bundled example questions and local-only scores; QuizDip published pack/API connection is future work. Five-person real-camera validation has not yet been performed. Keep raised fingers clearly separated from other hands.
