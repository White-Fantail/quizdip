# QuizDip — clue design and game quality

The platform's advantage is not question quantity: it is the **moment of discovery** when a player reasons from progressively revealed evidence. Clues typically move from subtle to explicit, but different games may choose different reveal counts, mechanics, answer entry and scoring.

## Editorial checks
1. Each step adds true, distinct information instead of restating earlier clues.
2. Early clues invite several plausible guesses; later clues narrow to a defensible answer. Avoid a single giveaway too early.
3. Test for ambiguity and alternative correct answers. Store acceptable aliases, normalizations and corrections.
4. Sequence clues fairly for the **creator's intended audience** (for example, young dinosaur fans versus adult history players).
5. Photos, audio, video and maps are **evidence in the deduction**, not decoration.
6. Attribute and check sources, accuracy, rights and context. Be neutral and factual for politics, history and public figures.
7. Make guessing accessible (sound alternatives, readable clues, reliable controls), and don't ship private answer keys with unrevealed evidence.

## Game variants
- **People:** career, actions, scientific contributions, timeline or biography; support political/historical figures without partisan framing.
- **Animals:** partial image, habitat, call, food and physical traits, with child-friendly visual/audio progression.
- **Places:** map/globe picks, geographic shape, cultural and historical context, landscape and photos.
- **Objects and concepts:** properties, purpose, inventor, physical behavior and scientific context.

Different games may have different clue counts, timers, answers, partial-image reveal and point curves. Fewer clues = more points is one valid design, not a mandatory universal algorithm. Reuse Question/Answer/Clue/Media primitives.

## AI-assisted authoring
Start from a creator's short natural-language intent. Generate the answer and its accepted variations; draft nonredundant clues; inspect logical order, unique solvability, facts, media suitability and age-appropriate vocabulary. Let the creator edit or reorder anything and preview the progressive play. AI's difficulty/audience recommendation **does not determine safety eligibility**.

After publishing, use play and creator signals to improve: correctness after each clue, number of clues revealed, completion and abandonment, time to answer, ambiguity/error reports, likes and dislikes. Unexpectedly high early accuracy can suggest giveaway clues; a sudden large jump between clue steps suggests sequencing trouble. These are review signals, **not automatic grounds for deletion**. When answer or clue substance changes, version the quiz and keep historic scores tied to the old version.

See [product principles](product-principles.md), [content policy](content-policy.md), [quiz metadata](quiz-metadata.md) and [play modes](play-modes.md).

## Editorial fun quality (all creator interfaces)

Before authoring, consult `quizdip_catalog.funQuality` via REST/MCP. Its 100 editorial points cover opening curiosity (20), accurate surprise/discovery (25), plausible and uniquely defensible choices or fair clues (15), variety/pacing (20), and a memorable ending (20). These are questions for an agent or editor, not objective measurements. A score may be assigned after substantive reading, but the server intentionally returns no artificial score. Pack draft/preflight/preview operations return non-blocking diagnostics and a standalone `pack_fun_review` allows a safe read-only follow-up. Never force joke content, four options, a long introduction or story chapters when it harms the content's intended audience or learning goal.
