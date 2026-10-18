import { createHash } from "node:crypto";

type Answer = { canonical: string; aliases?: string[]; responseMode?: string; options?: string[] };

/** Legacy questions do not have responseMode: they always remain free-text. */
export function answerResponseMode(value: unknown): "text" | "multiple-choice" {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "text";
  return (value as Answer).responseMode === "multiple-choice" ? "multiple-choice" : "text";
}

/** Stable per session/round, but varies between replays. No correct-answer metadata is sent. */
export function disclosedAnswerChoices(value: unknown, sessionId: string): string[] {
  if (answerResponseMode(value) !== "multiple-choice") return [];
  const answer = value as Answer;
  if (!Array.isArray(answer.options)) return [];
  const digest = (choice: string) => createHash("sha256")
    .update(sessionId + ":choice:" + choice).digest("hex");
  return [...answer.options].sort((a, b) => digest(a).localeCompare(digest(b)));
}

export function publicAnswerFormat(value: unknown, sessionId: string): { responseMode: "text" | "multiple-choice"; options?: string[] } {
  const responseMode = answerResponseMode(value);
  return { responseMode, ...(responseMode === "multiple-choice"
    ? { options: disclosedAnswerChoices(value, sessionId) } : {}) };
}

/** Preserve only an authored, validated option (never arbitrary free-text guesses).
 * Use the immutable pinned revision so later edits cannot relabel older votes.
 * Null means the question used text input or the submitted option was invalid.
 */
export function firstAuthoredChoice(value: unknown, guess: unknown): string | null {
  if (answerResponseMode(value) !== "multiple-choice" ||
      typeof guess !== "string" || !Array.isArray((value as Answer).options)) return null;
  const key = (text: string) => text.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const result = (value as Answer).options!.find(option => key(option) === key(guess));
  return result ?? null;
}
