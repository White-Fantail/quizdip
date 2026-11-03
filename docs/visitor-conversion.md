# QuizDip first-visit conversion experiment (2026-11-03)
Branch: dev. Priority: solve a visitor's first problem before asking them to explore accounts, Studio, rankings or lengthy packs.

## What changed
- The homepage places a real, published, language-appropriate General quiz prompt in its first screen. One click opens that actual playable question; a separate quick-five button opens a game **without an extra selection screen**. No sign-in required for either.
- Public pack cards offer direct Play and optional Details. Existing pack moderation, localized playable revisions, pinned runs and scoring are reused; Kids restrictions are never bypassed.
- A completed RANDOM_FIVE run offers a challenge link. This is a game invitation, **not** a public score permalink or verified score claim. Full PACK has its own separate opt-in result sharing.
- First-party daily counters record coarse, tab-session-deduplicated landing/teaser/start/first-answer/finish/share events. Admin checks aggregate totals at /admin/growth; no additional Vercel Analytics plan required.

## How to evaluate for 14 days
1. Ensure deployment database has migration 20261103080000_growth_funnel_daily. Confirm /admin/growth works with an ADMIN account.
2. On phone in English and Korean, from incognito, open homepage, enter featured single quiz, select an answer, complete and check that player score saves. Repeat with quick-five, refresh/resume, finish, share/copy a friend challenge.
3. Verify guest play, signed-in play, 1–N keyboard behavior, translation, error retries, and 20-question pack start from both Discover and Pack lists.
4. Compare /admin/growth with actual completed PlayRun/PlaySession counts at /admin/analytics and Vercel pageviews. Unknown referrals, redirects and manual tests affect measurements.
5. Only after enough real visits, compare landing→first-answer and first-answer→finish trends. These counters are *approximate steps*, not deduplicated unique conversion rates or verified activity.

## Important remaining concerns
- Recent multiple-choice quiz packs often have **zero progressive clues**. This is allowed by the rules but conflicts with QuizDip's principal clue-based identity. Audit editorial quality, add optional high-quality clues to the first recommended questions, without editing publication/packs blindly.
- Zero completed games cannot distinguish weak content from blocked login, load errors or confusing UI until first-hand device testing is done.
- Browser opt-out and session storage restrictions may undercount; automated/bot events may overcount. Never use these client counters as ranking or abuse decisions.
- Production launch, deployment and main merge require explicit authorization.
