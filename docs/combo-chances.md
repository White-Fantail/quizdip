# QuizDip combo and chance rules

Scope: new general PACK runs have version 2 combo scoring; legacy runs, random five, infinite and single quiz are unchanged.

- Solved question: combo +1. The first correct answer gets base score, then +5% per combo, capped at +25% from combo 6.
- Opening a clue does not affect the combo. Any incorrect guess immediately resets the combo. A later correct guess in the same question starts at 1. Points already won are never lost.
- Each general quiz pack run tracks its own best and current combo. Starting another run resets the streak.
- Chances cost no score. Authenticated users begin with three account-wide chances, earn one per UTC calendar day after the first day and can hold at most five.
- At most two chances per pack run, and at most one per question, before any submitted answer. A chance eliminates one incorrect option (when at least three choices exist), or reveals one grapheme (in text answers of at least three alphanumeric graphemes).
- Guest players see a sign-in prompt, but are never blocked from playing. Existing guest run capabilities remain valid after sign-in.
- Spending is server-authorized, atomic and idempotent. Sync recalculates version-2 combo points from pinned questions and first-attempt information.
- The downloadable local-play bundle contains answer keys by design; the local-first trust model remains in place. This feature is not an anti-cheat system.
