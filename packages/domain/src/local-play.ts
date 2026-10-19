import { isCorrectAnswer, scoreForAnswer, normalizeAnswer, comboAward } from "./game.ts";

export type LocalAnswer = { canonical:string; aliases:string[]; responseMode?:"text"|"multiple-choice"; options?:string[] };
export type LocalClue = { id?:string; type:string; text?:string; mediaId?:string; [key:string]:unknown };
export type LocalQuestion = {
  quizId:string; revisionId:string; title:string; prompt:string; explanation?:string;
  promptMediaIds:string[]; clues:LocalClue[]; answer:LocalAnswer;
};
export type LocalProgress = {
  clueIndex:number; wrongGuesses:number; status:"ACTIVE"|"SOLVED"|"FAILED";
  score:number; mustReveal:boolean; hadWrongGuess?:boolean; firstChoice?:string;
  chanceHint?:{kind:"remove-choice";option:string}|{kind:"reveal-letter";index:number;character:string};
};
export type LocalGuess = { correct:boolean; status:LocalProgress["status"]; score:number;
  cluesUsed:number; answer?:string; next?:string };
/** A deterministic game state; no network calls or clocks inside the reducer. */
export function initialLocalProgress(clueCount=1):LocalProgress {
  return {clueIndex:clueCount===0?0:1,wrongGuesses:0,status:"ACTIVE",score:0,mustReveal:false};
}
export function revealLocalClue(question:LocalQuestion,state:LocalProgress):LocalProgress {
  if(state.status!=="ACTIVE"||state.clueIndex>=question.clues.length)return state;
  return {...state,clueIndex:state.clueIndex+1,mustReveal:false};
}
export function guessLocalAnswer(question:LocalQuestion,state:LocalProgress,guess:string,previousCombo=0,comboEnabled=false):
  {progress:LocalProgress;result:LocalGuess}|null {
  if(state.status!=="ACTIVE"||state.mustReveal||!guess.trim())return null;
  const answer=question.answer;
  if(answer.responseMode==="multiple-choice" &&
     !(answer.options??[]).some(option=>normalizeAnswer(option)===normalizeAnswer(guess)))return null;
  const correct=isCorrectAnswer(answer,guess);
  const failed=!correct&&state.clueIndex>=question.clues.length;
  const status=correct?"SOLVED":failed?"FAILED":"ACTIVE";
  const combo=correct?(state.hadWrongGuess?1:previousCombo+1):0;
  const base=correct?scoreForAnswer(question.clues.length,state.clueIndex,answer.responseMode):0;
  const score=correct&&comboEnabled?comboAward(base,combo):base;
  const firstChoice=answer.responseMode==="multiple-choice" && !state.firstChoice
    ? (answer.options??[]).find(option=>normalizeAnswer(option)===normalizeAnswer(guess))
    : undefined;
  const progress:LocalProgress={...state,status,score,hadWrongGuess:!correct||Boolean(state.hadWrongGuess),
    ...(firstChoice ? {firstChoice} : {}),
    wrongGuesses:correct?state.wrongGuesses:state.clueIndex,
    mustReveal:!correct&&!failed};
  return {progress,result:{correct,status,score,cluesUsed:state.clueIndex,
    ...(status==="ACTIVE"?{next:"Reveal the next clue"}:{answer:answer.canonical})}};
}
export function localSummary(progress:LocalProgress[]) {
  const completed=progress.filter(p=>p.status!=="ACTIVE");
  return {completed:completed.length,score:completed.reduce((n,p)=>n+p.score,0),
    solved:completed.filter(p=>p.status==="SOLVED").length,
    failed:completed.filter(p=>p.status==="FAILED").length};
}
