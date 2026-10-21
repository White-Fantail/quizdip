"use client";

import Link from "next/link";
import { ExplanationText } from "../../../../../../src/components/explanation-text";
import { ImageReveal, type RevealSettings } from "../../../../../../src/components/image-reveal";
import { activeImageStage } from "@quizdip/domain";
import { useEffect, useState, type FormEvent } from "react";
import { isCorrectAnswer, scoreForAnswer } from "@quizdip/domain";
import { RatingBadge } from "../../../../../../src/components/quiz-ratings";
import type { RatingSummary } from "../../../../../../src/modules/quiz/rating-metadata";
import { useLocale } from "../../../../../../src/i18n/provider";
import { localizeHref } from "../../../../../../src/i18n/core";
import { bilingual } from "../../../../../../src/i18n/view-copy";

type Clue={
  type:"text"|"image"|"image-reveal"|"audio"|"video"|"map";
  text?:string;
  mediaId?:string;
  reveal?:RevealSettings;
  map?:{latitude:number;longitude:number;zoom?:number};
};
type Quiz={
  id:string;title:string;prompt:string;version:number;publication:string;locale:string;
  clueCount:number;clues:Clue[];promptMediaIds:string[];
  explanation?:string;answer:{canonical:string;aliases:string[];responseMode?:"text"|"multiple-choice";options?:string[]};ratings:RatingSummary;
};
type Media={id:string;kind:"image"|"audio"|"video";previewUrl?:string;alt?:string;status:string};
type Result="ACTIVE"|"SOLVED"|"FAILED"|"REVEALED";

async function ownerGet<T>(path:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch("/api/v1"+path,{
    method:"GET",credentials:"same-origin",cache:"no-store",signal
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.message||payload.error||"Could not load preview content.");
  return payload.data as T;
}

/** Client-only play simulation: no POST /play, /runs, /guess, analytics or reviews. */
export default function StudioQuizPreview({quizId,detailHref}:{quizId:string;detailHref:string}){
  const locale=useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const [quiz,setQuiz]=useState<Quiz|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [clueIndex,setClueIndex]=useState(1);
  const [guess,setGuess]=useState("");
  const [needsNext,setNeedsNext]=useState(false);
  const [result,setResult]=useState<Result>("ACTIVE");
  const [feedback,setFeedback]=useState("");
  const [media,setMedia]=useState<Record<string,Media>>({});
  const [mediaErrors,setMediaErrors]=useState<Record<string,string>>({});
  const [attempt,setAttempt]=useState(0);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");setQuiz(null);setMedia({});setMediaErrors({});
    setClueIndex(1);setGuess("");setNeedsNext(false);setResult("ACTIVE");setFeedback("");
    void ownerGet<Quiz>("/quizzes/"+encodeURIComponent(quizId),controller.signal).then(data=>{
      if(controller.signal.aborted)return;
      if(!data.answer||!Array.isArray(data.clues))
        throw new Error(msg("Only the author can preview this quiz.","문제 제작자만 미리 볼 수 있어요."));
      setClueIndex(data.clues.length===0?0:1);
      setQuiz(data);
    }).catch(e=>{
      if(!controller.signal.aborted)setError(e instanceof Error?e.message:msg("Could not load preview.","미리보기를 불러오지 못했어요."));
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[quizId,attempt]);

  // Owner-only signed previews are fetched at each reveal (60-second lifetime).
  // Unlike live play, this never creates or mutates a playSession.
  useEffect(()=>{
    if(!quiz)return;
    const controller=new AbortController();
    const seen=quiz.clues.slice(0,clueIndex);
    const mediaIds=[...new Set([...quiz.promptMediaIds,...seen.map(clue=>clue.mediaId)].filter((id):id is string=>!!id))];
    void Promise.all(mediaIds.map(async id=>{
      try{
        const asset=await ownerGet<Media>("/media/"+encodeURIComponent(id),controller.signal);
        if(!controller.signal.aborted){
          setMedia(old=>({...old,[id]:asset}));
          setMediaErrors(old=>({...old,[id]:""}));
        }
      }catch(e){
        if(!controller.signal.aborted)setMediaErrors(old=>({...old,[id]:e instanceof Error?e.message:"Media unavailable"}));
      }
    }));
    return ()=>controller.abort();
  },[quiz,clueIndex]);

  const reset=()=>{
    setClueIndex(1);setGuess("");setNeedsNext(false);setResult("ACTIVE");setFeedback("");
    setMedia({});setMediaErrors({});setAttempt(i=>i+1);
  };
  const reveal=()=>{
    if(!quiz||clueIndex>=quiz.clues.length||result!=="ACTIVE")return;
    setClueIndex(i=>i+1);setGuess("");setNeedsNext(false);setFeedback("");
  };
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!quiz||!guess.trim()||needsNext||result!=="ACTIVE")return;
    if(isCorrectAnswer({canonical:quiz.answer.canonical,aliases:quiz.answer.aliases||[]},guess)){
      setResult("SOLVED");setFeedback(msg("Correct! You got it! 🎉","정답이야! 알아냈네! 🎉"));
    }else if(clueIndex>=quiz.clues.length){
      setResult("FAILED");setFeedback(msg("That's the end of this quiz. Try again!","아쉽지만 이번 퀴즈는 여기까지야."));
    }else{
      setNeedsNext(true);setFeedback(msg("Not quite! Reveal the next clue and try again.","아직 아니야! 다음 단서를 보고 다시 추리해 봐."));
    }
  };
  const mediaView=(id:string,reveal?:RevealSettings)=>{
    const item=media[id];
    if(!item?.previewUrl)
      return <div className="muted" role="status">{mediaErrors[id]?
        msg("Media preview unavailable: ","미디어 미리보기 오류: ")+mediaErrors[id]:
        msg("Loading media…","이미지·미디어 불러오는 중…")}</div>;
    if(item.kind==="image")return reveal ?
      <ImageReveal src={item.previewUrl} reveal={reveal} alt={msg("Revealing quiz image","점차 드러나는 퀴즈 이미지")}/> :
      <img className="round-media" src={item.previewUrl} alt={msg("Image clue","그림 단서")}/>;
    if(item.kind==="audio")return <audio className="round-audio" src={item.previewUrl} controls preload="none"/>;
    if(item.kind==="video")return <video className="round-media" src={item.previewUrl} controls preload="metadata"/>;
    return <p className="muted">{msg("Unsupported media.","지원되지 않는 미디어예요.")}</p>;
  };
  return <main className="container inner-page discover-solo studio-quiz-preview">
    <div className="studio-preview-toolbar">
      <div>
        <Link className="card-link" href={detailHref}>
          {msg("← Back to quiz editor","← 문제 관리로 돌아가기")}
        </Link>
        <span className="eyebrow">QUIZDIP STUDIO / PREVIEW</span>
        <h1>{msg("Test play","테스트 플레이")}</h1>
      </div>
      <button type="button" className="btn btn-outline" onClick={reset}>
        {msg("Restart preview","처음부터 다시")}
      </button>
    </div>
    <div className="studio-preview-notice" role="note">
      <strong>{msg("Preview only · No play records","제작자 미리보기 · 기록되지 않음")}</strong>
      <p>{msg("See your current saved version as a player would, even if it is a draft, hidden or awaiting safety review. Guesses, score, reviews and play counts are never saved.",
        "초안·비공개·심사 대기 문제도 현재 저장된 버전으로 테스트할 수 있어요. 정답 입력, 점수, 리뷰, 플레이 횟수는 저장되지 않습니다.")}</p>
    </div>
    {loading&&<p role="status" className="muted">{msg("Loading quiz…","문제 불러오는 중…")}</p>}
    {error&&<p role="alert" className="feedback">{error}</p>}
    {quiz&&<section className="play-panel" aria-live="polite">
      <div className="play-top">
        <span className="small-tag">{msg("Progressive clues","단계별 단서")}</span>
        {quiz.clues.length>0&&<span className="clue-count">{msg("Clue ","단서 ")}{clueIndex} / {quiz.clues.length}</span>}
        <RatingBadge ratings={quiz.ratings}/>
      </div>
      <p className="muted studio-preview-version">
        v{quiz.version} · {quiz.publication==="DRAFT"?msg("Draft","초안"):quiz.publication==="HIDDEN"?msg("Hidden","비공개"):msg("Published","공개")}
        {" · "}{quiz.locale==="und"?msg("Unclassified language","언어 미분류"):quiz.locale.toUpperCase()}
      </p>
      <h1>{quiz.title}</h1>
      <h2 className="quiz-question-prompt">{quiz.prompt}</h2>
      {quiz.promptMediaIds?.length>0&&<div className="clue-media-list">
        {quiz.promptMediaIds.map(id=><div key={id}>{mediaView(id)}</div>)}
      </div>}
      <ol className="clue-list">
        {quiz.clues.slice(0,clueIndex).map((clue,index)=>{
          const stage=activeImageStage(quiz.clues.slice(0,clueIndex),index);
          if(!stage&&!clue.text&&!clue.map)return null;
          return <li key={index} style={{counterSet:`clue ${index}`}}>
          {clue.text&&<p>{clue.text}</p>}
          {stage?.mediaId&&mediaView(stage.mediaId,stage.type==="image-reveal"?stage.reveal:undefined)}
          {clue.type==="map"&&clue.map&&<div className="map-clue">
            <a target="_blank" rel="noopener noreferrer"
              href={"https://www.openstreetmap.org/?mlat="+clue.map.latitude+
                "&mlon="+clue.map.longitude+"#map="+(clue.map.zoom??8)+
                "/"+clue.map.latitude+"/"+clue.map.longitude}>
              {msg("View map clue ↗","지도 단서 보기 ↗")}
            </a>
          </div>}
        </li>})}
      </ol>
      {result==="ACTIVE"&&clueIndex<quiz.clues.length&&<button type="button" className="btn btn-outline" onClick={reveal}>
        {msg("Reveal another clue","힌트 하나 더 볼까?")}
      </button>}
      {result==="ACTIVE"&&<form className="guess-form" onSubmit={submit}>
        <label id="preview-answer-label">{msg("What's your answer?","정답은 무엇일까요?")}</label>
        {quiz.answer.responseMode==="multiple-choice"&&quiz.answer.options?.length?
          <div className="guess-option-grid" role="group" aria-labelledby="preview-answer-label">
            {quiz.answer.options.map((_,index,all)=>all[(index+1+attempt)%all.length]).map((option,index)=><button key={option} type="button"
              className={"guess-option"+(guess===option?" selected":"")} aria-pressed={guess===option}
              disabled={needsNext} onClick={()=>setGuess(option)}>
              <span className="guess-option-letter">{String.fromCharCode(65+index)}</span>{option}
            </button>)}
          </div>:
          <input id="preview-guess" aria-labelledby="preview-answer-label" value={guess}
            onChange={e=>setGuess(e.target.value)} disabled={needsNext} maxLength={200}
            autoComplete="off" placeholder={msg("Type your answer","정답을 입력해 봐")}/>}
        <div className="guess-row">
          <button className="btn btn-primary" type="submit" disabled={!guess.trim()||needsNext}>
            {msg("Check answer","정답 확인")}
          </button>
        </div>
        {needsNext&&<p className="muted">{msg("Reveal another clue before guessing again.","다음 단서를 열면 다시 답할 수 있어요.")}</p>}
      </form>}
      {result!=="ACTIVE"&&quiz.explanation&&<section className="feature-card quiz-answer-explanation">
        <h3>{msg("Answer explanation","정답 해설")}</h3>
        <ExplanationText text={quiz.explanation}/>
      </section>}
      {feedback&&<div role="status" className={"feedback"+(result==="SOLVED"?" success":"")}>
        {feedback}
        {result!=="ACTIVE"&&<p>{msg("Answer: ","정답: ")}
          <strong>{quiz.answer.canonical}</strong>
          {result==="SOLVED"&&<> · {scoreForAnswer(quiz.clues.length,clueIndex,quiz.answer.responseMode)}{msg(" pts (not saved)","점 (저장 안 함)")}</>}
        </p>}
      </div>}
      {result==="ACTIVE"&&<div className="studio-preview-answer-action">
        <button className="text-button" type="button" onClick={()=>setResult("REVEALED")}>
          {msg("Show answer for review","검토용 정답 보기")}
        </button>
      </div>}
      {result==="REVEALED"&&<div role="status" className="feedback">
        {msg("Answer: ","정답: ")}<strong>{quiz.answer.canonical}</strong>
      </div>}
      {result!=="ACTIVE"&&<div className="actions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          {msg("Try again","다시 테스트하기")}
        </button>
        <Link className="btn btn-outline" href={detailHref}>
          {msg("Back to editing","수정하러 돌아가기")}
        </Link>
      </div>}
    </section>}
  </main>;
}
