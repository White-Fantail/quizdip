"use client";

import Link from "next/link";
import { ExplanationText } from "../../../../src/components/explanation-text";
import { ImageReveal, type RevealSettings } from "../../../../src/components/image-reveal";
import { RemainingClues } from "../../../../src/components/remaining-clues";
import { activeImageStage,initialLocalProgress,revealLocalClue,guessLocalAnswer,
  type LocalQuestion,type LocalProgress } from "@quizdip/domain";
import { useLocale } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";
import { bilingual } from "../../../../src/i18n/view-copy";
import { RatingBadge, RatingButtons, RatingSignIn, type RatingAccess } from "../../../../src/components/quiz-ratings";
import type { RatingSummary } from "../../../../src/modules/quiz/rating-metadata";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { answerShortcutIndex } from "../../../../src/modules/platform/keyboard-choice";

type Clue = { type: "text" | "image" | "image-reveal" | "audio" | "video" | "map"; text?: string;
  mediaId?: string; reveal?: RevealSettings; map?: {latitude:number;longitude:number;zoom?:number} };
type Session = { sessionId: string; sessionToken: string; title: string;
  prompt: string; promptMediaIds: string[]; clue: Clue; clueIndex: number; clueCount: number;
  responseMode?:"text"|"multiple-choice";options?:string[];
  ratings:RatingSummary;myRating:number|null;ratingAccess:RatingAccess;isTranslation?:boolean;myTranslationRating?:number|null };
type Media = { mediaId:string; url:string; kind:string };

async function api(path: string, body: unknown,locale:"en"|"ko"="en"): Promise<any> {
  const response = await fetch("/api/v1" + path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store", credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload.error === "weekly_reserved")
      throw new Error(bilingual(locale,"This quiz is in the official weekly challenge. Join it from Play.","이번 주 공식 챌린지에 포함된 문제예요. Play에서 주간 도전에 참여해 주세요."));
    if (payload.error === "not_for_kids")
      throw new Error(bilingual(locale,"This quiz is not yet approved for Kids play.","이 퀴즈는 아직 어린이 모드 안전성 승인을 받지 않았어요."));
    throw new Error(payload.message || bilingual(locale,"Could not start this quiz.","퀴즈를 진행하지 못했어요."));
  }
  return payload.data;
}
export default function SingleQuizPage() {
  const locale = useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,body:unknown)=>api(path,body,locale);
  const { quizId } = useParams<{ quizId: string }>();
  const localQuestion=useRef<LocalQuestion|null>(null);
  const localProgress=useRef<LocalProgress>(initialLocalProgress());
  const [session, setSession] = useState<Session | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [media, setMedia] = useState<Record<string, Media>>({});
  const [guess, setGuess] = useState("");
  const answerInputRef = useRef<HTMLInputElement>(null);
  const guessFormRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [mustReveal, setMustReveal] = useState(false);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"ACTIVE" | "SOLVED" | "FAILED">("ACTIVE");
  const [remainingClues, setRemainingClues] = useState<Clue[] | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    let active = true;
    setSession(null); setClues([]); setMedia({}); setBusy(true); setError("");
    setGuess(""); setFeedback(""); setMustReveal(false); setAnswer(""); setScore(0); setStatus("ACTIVE");
    setRemainingClues(null); setReviewOpen(false); setReviewBusy(false); setReviewError("");
    const kids = new URLSearchParams(window.location.search).get("kids") === "true";
    void request("/local-play/single/start", { quizId, kids, locale })
      .then((next:Session&{question:LocalQuestion}) => {
      if (!active) return;
      setSession(next);
      localQuestion.current=next.question;
      localProgress.current=initialLocalProgress(next.question.clues.length);
      setClues(next.question.clues.slice(0,localProgress.current.clueIndex) as Clue[]);
      const ids = [...next.promptMediaIds,next.question.clues[0]?.mediaId].filter((id):id is string => !!id);
      void Promise.all([...new Set(ids)].map(async id => {
        try {
          const asset = await request("/local-play/single/media",
            { sessionToken: next.sessionToken, mediaId: id });
          if (active) setMedia(old => ({ ...old, [id]: asset }));
        } catch { /* Missing or restricted assets are never treated as public URLs. */ }
      }));
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : msg("Could not start this quiz.","퀴즈를 시작하지 못했어요.")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [quizId,locale]);

  async function reveal() {
    if(!session||!localQuestion.current)return;
    setError("");
    const p=revealLocalClue(localQuestion.current,localProgress.current);
    localProgress.current=p;
    const clue=localQuestion.current.clues[p.clueIndex-1] as Clue;
    setClues(localQuestion.current.clues.slice(0,p.clueIndex) as unknown as Clue[]);
    setSession(previous=>previous?{...previous,clueIndex:p.clueIndex}:previous);
    setMustReveal(false);setFeedback("");setGuess("");
    if(clue?.mediaId){
      void request("/local-play/single/media",{sessionId:session.sessionId,
        sessionToken:session.sessionToken,mediaId:clue.mediaId}).then(asset=>
        setMedia(previous=>({...previous,[clue.mediaId!]:asset}))).catch(()=>{});
    }
  }
  async function submitGuess(selectedAnswer: string) {
    if (!session || !selectedAnswer.trim() || mustReveal || busy || status !== "ACTIVE" || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true); setError("");
    try {
      if(!localQuestion.current)return;
      const attempt=guessLocalAnswer(localQuestion.current,localProgress.current,selectedAnswer.trim());
      if(!attempt)return;
      localProgress.current=attempt.progress;
      const result=attempt.result;
      if(result.status!=="ACTIVE")void request("/local-play/single/sync",{
        sessionId:session.sessionId,sessionToken:session.sessionToken,
        cluesUsed:attempt.progress.clueIndex,status:attempt.progress.status,
        score:attempt.progress.score,
        ...(attempt.progress.firstChoice ? {firstChoice:attempt.progress.firstChoice} : {})
      }).catch(()=>{});
      if (result.status === "ACTIVE") {
        setFeedback(msg("Not quite! Reveal the next clue and try again.","아직 아니야! 다음 단서를 보고 다시 추리해 봐."));
        setMustReveal(true);
      } else {
        setStatus(result.status);
        setAnswer(result.answer ?? "");
        setScore(result.score ?? 0);
        setFeedback(result.correct ? msg("Correct! You got it! 🎉","정답이야! 알아냈네! 🎉") : msg("That's the end of this quiz. Try another!","아쉽지만 이번 퀴즈는 여기까지야."));
      }
    } catch (e) { setError(e instanceof Error ? e.message : msg("Could not check your answer.","정답을 확인하지 못했어요.")); }
    finally { submittingRef.current = false; setBusy(false); }
  }
  async function toggleRemainingClues() {
    if (!session || reviewBusy || status === "ACTIVE") return;
    if (reviewOpen) { setReviewOpen(false); return; }
    setReviewOpen(true);
    if (remainingClues) return;
    if(localQuestion.current){
      const unseen=localQuestion.current.clues.slice(session.clueIndex) as unknown as Clue[];
      setRemainingClues(unseen);
      void Promise.all([...new Set(unseen.map(c=>c.mediaId).filter((id):id is string=>!!id))]
        .map(async id=>{
          try{
            const asset=await request("/local-play/single/media",{
              sessionId:session.sessionId,sessionToken:session.sessionToken,mediaId:id
            });setMedia(previous=>({...previous,[id]:asset}));
          }catch{}
        }));
      return;
    }
    setReviewBusy(true); setReviewError("");
    try {
      const result = await request("/play/" + session.sessionId + "/review",
        { sessionToken: session.sessionToken });
      const unseen = result.clues as Clue[];
      setRemainingClues(unseen);
      await Promise.all([...new Set(unseen.map(clue => clue.mediaId).filter((id):id is string => !!id))].map(async id => {
        try {
          const asset = await request("/play/" + session.sessionId + "/media",
            { sessionToken: session.sessionToken, mediaId: id });
          setMedia(old => ({ ...old, [id]: asset }));
        } catch { /* Restricted or missing media stays inaccessible. */ }
      }));
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : msg("Could not load the remaining clues.", "남은 단서를 불러오지 못했어요."));
    } finally { setReviewBusy(false); }
  }
  const remainingCount = session ? Math.max(0, session.clueCount - session.clueIndex) : 0;

  useEffect(()=>{
    if(!session||status!=="ACTIVE"||busy||mustReveal||session.responseMode==="multiple-choice")return;
    if(window.matchMedia("(pointer: fine)").matches){
      answerInputRef.current?.focus({preventScroll:true});
    }
  },[session?.sessionId,session?.clueIndex,session?.responseMode,status,busy,mustReveal]);

  useEffect(()=>{
    function handleKeyboard(event:KeyboardEvent) {
      if(event.repeat||event.isComposing||event.keyCode===229||
         event.altKey||event.shiftKey||busy||status!=="ACTIVE"||!session)return;
      if(!mustReveal&&session.responseMode==="multiple-choice"&&session.options){
        const index=answerShortcutIndex(event);
        const target=event.target;
        const editing=target instanceof HTMLElement &&
          !!target.closest('input,textarea,select,audio,video,[contenteditable="true"],[role="textbox"]');
        if(index!==null&&index<session.options.length&&!editing){
          event.preventDefault();
          const option=session.options[index];
          setGuess(option);
          // Keep Enter as the separate confirmation action.
          guessFormRef.current?.focus({preventScroll:true});
          return;
        }
      }
      if(event.key!=="Enter")return;
      const target=event.target;
      if(target instanceof HTMLElement){
        const interactive=target.closest('input,textarea,select,a,button,[role="button"],[contenteditable="true"]');
        const focusedChoice=target.closest<HTMLButtonElement>('button[data-quizdip-choice]');
        // Enter activates a focused, unselected choice before it can submit.
        if(focusedChoice&&session.options?.[Number(focusedChoice.dataset.quizdipChoice)]!==guess)return;
        if(interactive&&interactive!==answerInputRef.current&&!focusedChoice)return;
      }
      if(event.ctrlKey||event.metaKey){
        if(session.clueIndex<session.clueCount){event.preventDefault();void reveal();}
        return;
      }
      if(!mustReveal&&guess.trim()){
        if(target!==answerInputRef.current){
          event.preventDefault();guessFormRef.current?.requestSubmit();
        }
      }else if(session.clueIndex<session.clueCount){
        event.preventDefault();void reveal();
      }
    }
    window.addEventListener("keydown",handleKeyboard);
    return ()=>window.removeEventListener("keydown",handleKeyboard);
  },[session,status,busy,mustReveal,guess]);

  function clueMedia(id: string, reveal?:RevealSettings) {
    const asset = media[id];
    if (!asset) return <p className="muted">{msg("Could not load this media.","미디어를 불러올 수 없어요.")}</p>;
    if (asset.kind === "image") return reveal ?
      <ImageReveal src={asset.url} alt={msg("Revealing quiz image","점차 드러나는 퀴즈 이미지")} reveal={reveal}/> :
      <img className="round-media" src={asset.url} alt={msg("Quiz clue image","퀴즈 단서 이미지")}/>;
    if (asset.kind === "audio") return <audio className="round-audio" src={asset.url} controls preload="none"/>;
    if (asset.kind === "video") return <video className="round-media" src={asset.url} controls preload="metadata"/>;
    return null;
  }
  return <main className="container inner-page discover-solo">
    <span className="eyebrow">QUIZDIP · PLAY</span>
    <Link className="card-link" href={localizeHref("/discover",locale)}>{msg("← Discover more quizzes","← 다른 퀴즈 둘러보기")}</Link>
    {busy && !session && <p className="muted" role="status">{msg("Preparing your quiz…","퀴즈를 준비하고 있어요…")}</p>}
    {session && <section className="play-panel" aria-live="polite">
      <div className="play-top">
        <span className="small-tag">{msg("Progressive clues","단계별 단서")}</span>
        {session.clueCount>0&&<span className="clue-count">{msg("Clue ","단서 ")}{session.clueIndex} / {session.clueCount}</span>}
        <RatingBadge ratings={session.ratings}/>
      </div>
      <h1>{session.title}</h1>
      <h2 className="quiz-question-prompt">{session.prompt}</h2>
      {session.promptMediaIds.length > 0 && <div className="clue-media-list">
        {session.promptMediaIds.map(id => <div key={id}>{clueMedia(id)}</div>)}
      </div>}
      <ol className="clue-list">
        {clues.map((clue, index) => {
          const stage=activeImageStage(clues,index);
          if(!stage&&!clue.text&&!clue.map)return null;
          return <li key={index} style={{counterSet:`clue ${index}`}}>
          {clue.text && <p>{clue.text}</p>}
          {stage?.mediaId && clueMedia(stage.mediaId,stage.type==="image-reveal"?stage.reveal:undefined)}
          {clue.type === "map" && clue.map && <div className="map-clue">
            <a target="_blank" rel="noopener noreferrer"
              href={"https://www.openstreetmap.org/?mlat=" + clue.map.latitude +
                "&mlon=" + clue.map.longitude + "#map=" + (clue.map.zoom ?? 8) +
                "/" + clue.map.latitude + "/" + clue.map.longitude}>{msg("View map clue ↗","지도 단서 보기 ↗")}</a>
          </div>}
        </li>})}
      </ol>
      {status === "ACTIVE" && session.clueIndex < session.clueCount &&
        <button type="button" className="btn btn-outline" disabled={busy}
          onClick={() => void reveal()}>{msg("Reveal another clue","힌트 하나 더 볼까?")}</button>}
      {status === "ACTIVE" && <form ref={guessFormRef} className="guess-form" tabIndex={-1} onSubmit={e => {e.preventDefault();void submitGuess(guess);}}
        onKeyDown={e=>{if(e.key==="Enter"&&(e.nativeEvent.isComposing||e.nativeEvent.keyCode===229))e.preventDefault();}}>
        <label id="single-quiz-answer-label">{msg("What's your answer?","정답은 무엇일까요?")}</label>
        {session.responseMode==="multiple-choice"&&session.options?.length?
          <div className="guess-option-grid" role="group" aria-labelledby="single-quiz-answer-label">
            {session.options.map((option,index)=><button key={option} type="button"
              className={"guess-option"+(guess===option?" selected":"")} aria-pressed={guess===option} data-quizdip-choice={index}
              disabled={busy||mustReveal} onClick={()=>setGuess(option)}>
              <span className="guess-option-letter">{index+1}</span>{option}
            </button>)}
          </div>:
          <input ref={answerInputRef} className="guess-input" id="single-quiz-answer" aria-labelledby="single-quiz-answer-label" maxLength={200} autoComplete="off"
            value={guess} onChange={e=>setGuess(e.target.value)}
            disabled={busy||mustReveal} placeholder={msg("Type your answer","정답을 입력해 봐")}/>}
        <div className="guess-row">
          <button className="btn btn-primary" type="submit"
            disabled={busy || mustReveal || !guess.trim()}>{msg("Check answer","정답 확인")}</button>
        </div>
        {mustReveal && <p className="muted">{msg("Reveal another clue before trying again.","새로운 단서를 열면 다시 답할 수 있어요.")}</p>}
      </form>}
      {status === "ACTIVE" && <p className="play-keyboard-help"><span aria-hidden="true">⌨</span>{" "}
        {session.responseMode==="multiple-choice"&&session.options?.length&&<>
          <kbd>1–{session.options.length}</kbd> {msg("Select an answer (number pad too)","숫자키·키패드로 보기 선택")} <span className="shortcut-divider">·</span>{" "}
        </>}
        <kbd>Enter</kbd> {session.responseMode==="multiple-choice"?msg("Submit selected answer · none: next clue","선택한 답 제출 · 미선택 시 다음 단서"):msg("Check answer · empty field: next clue","정답 확인 · 빈칸이면 다음 단서")} <span className="shortcut-divider">·</span> <kbd>Ctrl/⌘ + Enter</kbd> {msg("Reveal next clue","다음 단서")}</p>}
      {status!=="ACTIVE"&&localQuestion.current?.explanation&&<section className="feature-card quiz-answer-explanation">
        <h3>{msg("Answer explanation","정답 해설")}</h3>
        <ExplanationText text={localQuestion.current.explanation}/>
      </section>}
      {feedback && <div className={"feedback" + (status === "SOLVED" ? " success" : "")} role="status">
        {feedback}
        {status !== "ACTIVE" && <p>{msg("Answer: ","정답: ")}<strong>{answer}</strong> · {score}{msg(" pts","점")}</p>}
      </div>}
      {status !== "ACTIVE" && remainingCount > 0 && <section className="remaining-clue-review">
        <button type="button" className="btn btn-outline" disabled={reviewBusy}
          aria-expanded={reviewOpen} onClick={() => void toggleRemainingClues()}>
          {reviewOpen ? msg("Hide remaining clues", "남은 단서 접기") :
            msg(`View remaining clues (${remainingCount})`, `남은 단서 ${remainingCount}개 보기`)}
        </button>
        {reviewOpen && <>
          {reviewBusy && <p className="muted" role="status">{msg("Loading remaining clues…", "남은 단서를 불러오는 중…")}</p>}
          {reviewError && <p role="alert" className="feedback">{reviewError}</p>}
          {remainingClues && <RemainingClues clues={remainingClues}
            firstClueIndex={session.clueIndex + 1} media={media} />}
        </>}
      </section>}
      {status !== "ACTIVE" && <div className="single-rating-review">
        <h3>{msg("How was this quiz?","이 문제는 어땠나요?")}</h3>
        <RatingButtons quizId={quizId} locale={locale} initialRating={session.myRating} access={session.ratingAccess}
          onSaved={(ratings,value)=>setSession(old=>old?{...old,ratings,myRating:value}:old)}/>
        {session.isTranslation&&<div className="translation-quality-feedback">
          <p className="muted">{locale==="ko"?"번역은 자연스럽고 정확했나요?":"Was the translation clear and accurate?"}</p>
          <RatingButtons quizId={quizId} locale={locale} kind="TRANSLATION" initialRating={session.myTranslationRating??null} access={session.ratingAccess}
            onSaved={(_rating,value)=>setSession(old=>old?{...old,myTranslationRating:value}:old)}/>
        </div>}
        {session.ratingAccess==="SIGN_IN"&&<RatingSignIn destination={localizeHref("/play/"+quizId,locale)}/>}
      </div>}
      {status !== "ACTIVE" && <div className="actions">
        <Link className="btn btn-primary" href={localizeHref("/discover",locale)}>{msg("Discover more quizzes →","다른 퀴즈 발견하기 →")}</Link>
        <Link className="btn btn-outline" href={localizeHref("/play",locale)}>{msg("Play five random quizzes","랜덤 5문제 도전하기")}</Link>
      </div>}
    </section>}
    {error && <p className="feedback" role="alert">{error}</p>}
  </main>;
}
