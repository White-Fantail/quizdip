import type { QuizQuestion } from "./quiz.ts";

/** Demo/authoring helper only. Real games must validate guesses on the server. */
export function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function isCorrectAnswer(
  answer: QuizQuestion["answer"],
  guess: string,
): boolean {
  const normalized = normalizeAnswer(guess);
  return (
    normalized.length > 0 &&
    [answer.canonical, ...answer.aliases].some(
      (candidate) => normalizeAnswer(candidate) === normalized,
    )
  );
}

/** A sample score model. Future game modes may provide their own rules. */
export function scoreForClues(clueCount: number, cluesUsed: number): number {
  if (!Number.isInteger(clueCount) || clueCount < 1) return 0;
  if (!Number.isInteger(cluesUsed) || cluesUsed < 1) return 0;
  const used = Math.min(cluesUsed, clueCount);
  return Math.max(20, 100 - (used - 1) * (80 / Math.max(1, clueCount - 1)));
}

/** Explicit author-made choices have a lower ceiling than typed recall. Legacy quizzes are unchanged. */
export function scoreForAnswer(clueCount: number, cluesUsed: number, responseMode?: "text" | "multiple-choice"): number {
  // Answer-first multiple-choice uses the same 75-point ceiling as the first clue.
  if(clueCount===0 && cluesUsed===0 && responseMode==="multiple-choice")return 75;
  const base = scoreForClues(clueCount, cluesUsed);
  return Math.round(base * (responseMode === "multiple-choice" ? 0.75 : 1));
}

/** Each consecutive successful answer adds 5%, capped at 25%. */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(5, Math.max(0, Math.floor(combo) - 1)) * 0.05;
}
export function comboAward(baseScore: number, combo: number): number {
  return Math.round(Math.max(0, baseScore) * comboMultiplier(combo));
}

/** Current and best streak; an incorrect attempt breaks the streak even if later solved. */
export function comboProgress(rows: Array<{status:string;hadWrongGuess?:boolean}>){
  let current=0,best=0;
  for(const row of rows){
    if(row.hadWrongGuess || row.status==="FAILED")current=0;
    if(row.status==="SOLVED"){current++;best=Math.max(best,current);}
    if(row.status==="ACTIVE")break;
  }
  return {current,best};
}
