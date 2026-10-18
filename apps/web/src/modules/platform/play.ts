import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isCorrectAnswer, scoreForAnswer, normalizeAnswer } from "@quizdip/domain";
import { db } from "./db";
import { ratingsForQuiz, myRatingForQuiz, ratingAccess } from "./ratings";
import { fail, type Actor } from "./auth";
import { currentPlayableRevision } from "./content-locale";
import { completesRun } from "./run-length";
import { publicAnswerFormat, answerResponseMode, firstAuthoredChoice } from "./answer-options";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export async function getPlaySession(p: Record<string, any>, actor: Actor | null,
  { allowCompletedRun = false }: { allowCompletedRun?: boolean } = {}) {
  const session = await db().playSession.findUnique({
    where: { id: p.sessionId },
    include: { revision: { include: { localization: true } } }
  });
  if (!session) fail(404, "not_found", "Session not found");
  const provided = Buffer.from(hashToken(p.sessionToken), "hex");
  const expected = Buffer.from(session.tokenHash, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
    fail(403, "forbidden", "Invalid session capability");
  if (session.userId && session.userId !== actor?.id) fail(403, "forbidden", "Session belongs to another account");
  // An anonymous game capability alone must never bypass native child ownership.
  const child = session.runId
    ? await db().kidPlayRun.findUnique({where:{runId:session.runId}})
    : await db().kidPlaySingle.findUnique({where:{sessionId:session.id}});
  if (child && (actor?.childScope?.profileId!==child.profileId ||
      actor?.childScope?.deviceId!==child.deviceId))
    fail(403,"kid_play_forbidden","A child-only game requires its authorized device");
  if (session.expiresAt.getTime() < Date.now()) fail(410, "session_expired", "Start another game");
  if (session.locale !== "und" && (session.revision.localization?.locale !== session.locale ||
    session.revision.localization.status !== "PUBLISHED"))
    fail(409, "locale_unavailable", "This question language is no longer available");
  const sessionQuiz=await db().quiz.findUnique({where:{id:session.quizId},select:{publication:true,safetyStatus:true}});
  if(!sessionQuiz || sessionQuiz.publication!=="PUBLISHED" || sessionQuiz.safetyStatus!=="ACTIVE")
    fail(409,"question_suspended","This quiz is no longer publicly playable");
  if (session.runId) {
    const run=await db().playRun.findUnique({where:{id:session.runId}});
    // Completed, pinned rounds remain reviewable after the run advances.
    // Active sessions must still belong to the original current round.
    const completed = session.status === "SOLVED" || session.status === "FAILED";
    if (!run || (!(allowCompletedRun && completed) &&
        (run.status!=="ACTIVE" || run.currentIndex!==session.roundIndex)))
      fail(409,"run_not_active","This run's active round has changed");
    if(run.mode==="PACK" && (!run.packId || !await db().quizPack.findFirst({
      where:{id:run.packId,publication:"PUBLISHED",safetyStatus:"ACTIVE",
        localizations:{some:{locale:run.locale,status:"PUBLISHED"}}},
      select:{id:true}
    })))fail(409,"pack_unavailable","This pack has been withdrawn");
    const quiz=await db().quiz.findUnique({where:{id:session.quizId}});
    if (!quiz || quiz.publication!=="PUBLISHED" || quiz.safetyStatus!=="ACTIVE" ||
      (run.lane==="KIDS" && !(quiz.safetyStatus==="ACTIVE"&&quiz.kidsEligible&&quiz.kidsReviewStatus==="APPROVED")))
      fail(409,"question_suspended","This quiz is unavailable for the chosen audience");
  }
  return session;
}
export async function playStart(p: Record<string, any>, actor: Actor | null) {
  const quiz = await db().quiz.findUnique({ where: { id: p.quizId } });
  if (!quiz || quiz.publication !== "PUBLISHED" || quiz.safetyStatus !== "ACTIVE")
    fail(404, "not_found", "Quiz unavailable");
  if (p.kids && !(quiz.safetyStatus==="ACTIVE"&&quiz.kidsEligible&&quiz.kidsReviewStatus==="APPROVED"))
    fail(403, "not_for_kids", "Quiz has not passed Kids eligibility checks");
  const { revision, translation } = await currentPlayableRevision(quiz.id, p.locale);
  if(p.kids && !["ORIGINAL","LEGACY"].includes(translation.origin))
    fail(403,"locale_safety_review_pending","Translated content requires separate child-safety approval");
  const clues = revision.clues as Record<string, unknown>[];
  if (!clues.length && (revision.answer as {responseMode?:string})?.responseMode!=="multiple-choice")
    fail(409, "invalid_quiz", "Only multiple-choice questions may omit clues");
  const token = randomBytes(32).toString("base64url");
  const session = await db().playSession.create({ data: {
    quizId: quiz.id, revisionId: revision.id, locale: p.locale, userId: actor?.id, tokenHash: hashToken(token),
    usedClues: clues.length===0?0:1, expiresAt: new Date(Date.now() + 3600000)
  } });
  const [ratings,myRating,myTranslationRating]=await Promise.all([ratingsForQuiz(quiz.id,p.locale),myRatingForQuiz(quiz.id,actor,p.locale),myRatingForQuiz(quiz.id,actor,p.locale,"TRANSLATION")]);
  return { sessionId: session.id, sessionToken: token, title: revision.title, prompt: revision.prompt,
    quizId:quiz.id,ratings,myRating,myTranslationRating,ratingAccess:ratingAccess(actor,quiz.authorId,session.userId),
    isTranslation:translation.origin==="TRANSLATION",
    mode: revision.mode, locale: p.locale, quizVersion: revision.version, promptMediaIds: revision.promptMediaIds, clue: clues[0], clueIndex: clues.length===0?0:1, clueCount: clues.length,
    ...publicAnswerFormat(revision.answer, session.id) };
}
/** Read-only review after grading, restricted to the completed pinned session. */
export async function playReview(p: Record<string, any>, actor: Actor | null) {
  const session = await getPlaySession(p, actor, { allowCompletedRun: true });
  if (session.status !== "SOLVED" && session.status !== "FAILED")
    fail(409, "review_not_available", "Finish the question before reviewing its remaining clues");
  const clues = session.revision.clues as Record<string, unknown>[];
  return { firstClueIndex: session.usedClues + 1, clueCount: clues.length,
    clues: clues.slice(session.usedClues) };
}

export async function playClue(p: Record<string, any>, actor: Actor | null) {
  const session = await getPlaySession(p, actor);
  if (session.status !== "ACTIVE") fail(409, "finished", "Game has already ended");
  const clues = session.revision.clues as Record<string, unknown>[];
  if (session.usedClues >= clues.length) fail(409, "no_more_clues", "No more clues available");
  const updated = await db().playSession.updateMany({
    where: { id: session.id, status: "ACTIVE", usedClues: session.usedClues, wrongGuesses: session.wrongGuesses },
    data: { usedClues: { increment: 1 } }
  });
  if (updated.count !== 1) fail(409, "conflict", "Concurrent session action, retry");
  return { sessionId: session.id, clue: clues[session.usedClues], clueIndex: session.usedClues + 1,
    clueCount: clues.length, remaining: clues.length - (session.usedClues + 1) };
}
export async function playGuess(p: Record<string, any>, actor: Actor | null) {
  const session = await getPlaySession(p, actor);
  if (session.status !== "ACTIVE") fail(409, "finished", "Game has already ended");
  const clues = session.revision.clues as unknown[];
  if (clues.length>0 && session.wrongGuesses >= session.usedClues) fail(429, "reveal_next_clue", "Reveal another clue before trying again");
  const answer = session.revision.answer as { canonical: string; aliases: string[]; responseMode?: "text" | "multiple-choice"; options?: string[] };
  if (answerResponseMode(answer) === "multiple-choice" && !answer.options?.some(option => normalizeAnswer(option) === normalizeAnswer(p.guess)))
    fail(400, "invalid_choice", "Select one of the supplied choices");
  const firstChoice = session.firstChoice === null ? firstAuthoredChoice(answer, p.guess) : null;
  const correct = isCorrectAnswer(answer, p.guess);
  const last = session.usedClues === clues.length;
  const failed = !correct && last;
  const score = correct ? scoreForAnswer(clues.length, session.usedClues, answer.responseMode) : 0;
  const terminal=correct || failed;
  await db().$transaction(async tx => {
    const updated = await tx.playSession.updateMany({
      where: { id: session.id, status: "ACTIVE", wrongGuesses: session.wrongGuesses, usedClues: session.usedClues },
      data: { wrongGuesses: correct ? session.wrongGuesses : session.usedClues,
        ...(firstChoice !== null ? { firstChoice } : {}),
        ...(terminal ? { status: correct ? "SOLVED" : "FAILED", score, finishedAt: new Date() } : {}) }
    });
    if (updated.count !== 1) fail(409, "conflict", "Concurrent session action, retry");
    if (terminal && session.runId) {
      const run=await tx.playRun.findUnique({where:{id:session.runId}});
      if (!run || run.status!=="ACTIVE" || run.currentIndex!==session.roundIndex ||
          run.expiresAt.getTime()<=Date.now())
        fail(409,"run_conflict","This run has already moved to another round");
      const finished=completesRun(run);
      const changed=await tx.playRun.updateMany({
        where:{id:run.id,status:"ACTIVE",currentIndex:run.currentIndex},
        data:{currentIndex:{increment:1},score:{increment:score},
          solved:{increment:correct?1:0},failed:{increment:failed?1:0},
          ...(finished?{status:"FINISHED",completedAt:new Date()}:{}),
        }
      });
      if(changed.count!==1) fail(409,"run_conflict","Run result was already counted");
    }
  });
  return {
    status: correct ? "SOLVED" : failed ? "FAILED" : "ACTIVE", correct, score, cluesUsed: session.usedClues,
    ...(correct || failed ? { answer: answer.canonical, explanation:session.revision.explanation } : { next: "Reveal the next clue" })
  };
}
