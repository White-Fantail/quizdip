"use client";

import Link from "next/link";
import { ImageReveal, type RevealSettings } from "../../../src/components/image-reveal";
import { RemainingClues } from "../../../src/components/remaining-clues";
import { activeImageStage, initialLocalProgress, revealLocalClue, guessLocalAnswer, localSummary, comboProgress,
  type LocalQuestion, type LocalProgress } from "@quizdip/domain";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { RatingBadge, RatingButtons, RatingSignIn, type RatingAccess } from "../../../src/components/quiz-ratings";
import PackFeedback from "../../../src/components/pack-feedback";
import PackResultShare from "../../../src/components/pack-result-share";
import AdSlot from "../../../src/components/ads/AdSlot";
import type { RatingSummary } from "../../../src/modules/quiz/rating-metadata";
import { useCallback, useEffect, useRef, useState } from "react";
import { answerShortcutIndex } from "../../../src/modules/platform/keyboard-choice";
import { storeCachedRun, syncCachedRun, recoverCachedRuns, runStorageKey, getCachedRun, cachedCompletedResults } from "../../../src/lib/local-run-sync";

type Lane = "GENERAL" | "KIDS";
type Mode = "RANDOM_FIVE" | "INFINITE" | "PACK";
type Chapter={start:number;title:string;description:string;mediaUrl?:string|null};
type ScoreReview={minimumScore:number;title:string;description:string};
type Clue = { id?: string; type: "text"|"image"|"image-reveal"|"audio"|"video"|"map";
  text?: string; mediaId?: string; reveal?:RevealSettings; map?: {latitude:number;longitude:number;zoom?:number} };
type RunInfo = {runId:string;runToken:string;mode:Mode;lane:Lane;packId?:string|null;packVersion?:number|null;
  completed:number;score:number;status:"ACTIVE"|"FINISHED";total:number|null;official?:boolean;
  solved?:number;failed?:number;scoringVersion?:number;currentCombo?:number;bestCombo?:number;chancesUsed?:number;
  exhausted?:boolean;message?:string};
type Round = RunInfo & {sessionId:string;sessionToken:string;round:number;quizId:string;title:string;
  prompt:string;explanation?:string;promptMediaIds:string[];clues:Clue[];clueIndex:number;clueCount:number;
  sessionStatus:string;canGuess?:boolean;responseMode?:"text"|"multiple-choice";options?:string[];ratings?:RatingSummary;myRating?:number|null;ratingAccess?:RatingAccess};
type LocalPack = {runId:string;questions:(LocalQuestion&{position:number;responseMode?:"text"|"multiple-choice";options?:string[]})[]};
type LocalSaved = {bundle:LocalPack;progress:Record<number,LocalProgress>;runToken:string;synced?:boolean};
const localKey=runStorageKey;
type FeedbackItem = {quizId:string;round:number;title:string;ratings:RatingSummary;myRating:number|null;ratingAccess:RatingAccess;isTranslation?:boolean;myTranslationRating?:number|null};
type MediaPreview = {url:string;kind:string;mimeType:string;mediaId:string};
type ChanceHint = {kind:"remove-choice";option:string}|{kind:"reveal-letter";index:number;character:string};
type ChanceBalance = {authenticated:boolean;balance:number;cap:number;daily:number};

async function api(path:string, method:"GET"|"POST"="GET",body?:unknown,locale:"en"|"ko"="en"):Promise<any> {
  const response=await fetch("/api/v1"+path,{
    method,credentials:"same-origin",cache:"no-store",
    headers:body!==undefined?{"Content-Type":"application/json"}:undefined,
    body:body!==undefined?JSON.stringify(body):undefined,
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) {
    const code=data.error;
    if(code==="not_enough_questions") throw new Error(data.message||bilingual(locale,"There aren't enough unseen quizzes. Come back when new ones are published.","새로운 문제가 충분하지 않아요. 새 퀴즈가 공개되면 다시 즐겨 주세요."));
    if(code==="question_suspended") throw new Error(bilingual(locale,"Play is temporarily paused while this question is reviewed.","문제 안전성 검토로 플레이가 잠시 중단됐어요."));
    if(code==="run_expired"||code==="week_closed") throw new Error(bilingual(locale,"This challenge has ended. Start a new one.","진행 기간이 끝났어요. 새 도전을 시작해 주세요."));
    throw new Error(data.message || code || bilingual(locale,"Something went wrong. Please try again.","요청을 처리하지 못했어요."));
  }
  return data.data;
}

const SEEN_KEY="quizdip-played-quiz-ids-v1";
function rememberedQuizzes():string[] {
  try {
    const ids=JSON.parse(localStorage.getItem(SEEN_KEY)||"[]");
    return Array.isArray(ids)?ids.filter((id):id is string=>
      typeof id==="string"&&/^[a-f0-9-]{36}$/i.test(id)).slice(-1000):[];
  } catch {return [];}
}
function rememberQuiz(id:string) {
  try {localStorage.setItem(SEEN_KEY,JSON.stringify([...new Set([...rememberedQuizzes(),id])].slice(-1000)));}
  catch { /* Device-only fallback; signed-in histories remain server-authoritative. */ }
}
function MediaPart({item,reveal}:{item:MediaPreview;reveal?:RevealSettings}) {
  const locale=useLocale();
  if(item.kind==="image") return reveal ?
    <ImageReveal src={item.url} reveal={reveal} alt={bilingual(locale,"Revealing quiz image","점차 드러나는 퀴즈 이미지")}/> :
    <img className="round-media" src={item.url} alt={bilingual(locale,"Published quiz clue image","공개된 단서 이미지")}/>;
  if(item.kind==="audio") return <audio controls src={item.url} preload="none" className="round-audio"/>;
  if(item.kind==="video") return <video controls src={item.url} preload="metadata" className="round-media"/>;
  return null;
}

export default function PlayPage({packId,resumeRunId}:{packId?:string;resumeRunId?:string}={}) {
  const locale = useLocale();
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const request=(path:string,method:"GET"|"POST"="GET",body?:unknown)=>api(path,method,body,locale);
  const localBundleRef=useRef<LocalPack|null>(null);
  const chapterStartsRef=useRef<number[]|null>(null);
  const localRunTokenRef=useRef("");
  const localProgressRef=useRef<Record<number,LocalProgress>>({});
  const [lane,setLane]=useState<Lane>("GENERAL");
  const [pack,setPack]=useState<{id:string;title:string;description:string;questionCount:number;kidsEligible?:boolean;
    sections:Chapter[];closingMessage:string;scoreReviews:ScoreReview[];author:{displayName:string}}|null>(null);
  const [chapterIntro,setChapterIntro]=useState<Chapter|null>(null);
  const [run,setRun]=useState<RunInfo|null>(null);
  const [round,setRound]=useState<Round|null>(null);
  const [guess,setGuess]=useState("");
  const answerInputRef=useRef<HTMLInputElement>(null);
  const guessFormRef=useRef<HTMLFormElement>(null);
  const submittingRef=useRef(false);
  const [busy,setBusy]=useState(false);
  const packStartKeyRef=useRef<string|null>(null);
  const [packStartStatus,setPackStartStatus]=useState<"loading"|"ready"|"error">(packId?"loading":"ready");
  const [error,setError]=useState("");
  const [feedback,setFeedback]=useState("");
  const [answer,setAnswer]=useState("");
  const [roundScore,setRoundScore]=useState(0);
  const [mustReveal,setMustReveal]=useState(false);
  const [media,setMedia]=useState<Record<string,MediaPreview>>({});
  const [myHistory,setMyHistory]=useState<RunInfo[]>([]);
  const [mode,setMode]=useState<Mode>("RANDOM_FIVE");
  const [questionsToRate,setQuestionsToRate]=useState<FeedbackItem[]>([]);
  const [ratingBusy,setRatingBusy]=useState(false);
  const [ratingError,setRatingError]=useState("");
  const [remainingClues,setRemainingClues]=useState<Clue[]|null>(null);
  const [reviewOpen,setReviewOpen]=useState(false);
  const [reviewBusy,setReviewBusy]=useState(false);
  const [reviewError,setReviewError]=useState("");
  const [syncState,setSyncState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const [syncError,setSyncError]=useState("");
  const [confirmedRunId,setConfirmedRunId]=useState<string|null>(null);
  const [combo,setCombo]=useState({current:0,best:0});
  const [chances,setChances]=useState<ChanceBalance|null>(null);
  const [chanceBusy,setChanceBusy]=useState(false);
  const [chanceError,setChanceError]=useState("");

  useEffect(()=>{
    if(!packId)return;
    let active=true;
    void request("/me/chances").then((data:ChanceBalance)=>{if(active)setChances(data);}).catch(()=>{});
    return ()=>{active=false;};
  },[packId,locale]);

  function streakThrough(position:number){
    const entries:LocalProgress[]=[];
    for(let i=0;i<=position;i++){
      const progress=localProgressRef.current[i];
      if(!progress)break;
      entries.push(progress);
      if(progress.status==="ACTIVE")break;
    }
    return comboProgress(entries);
  }
  function refreshCombo(){
    const size=localBundleRef.current?.questions.length??0;
    setCombo(streakThrough(size-1));
  }

  useEffect(()=>{
    // Deep links from Kids and campaigns must preserve the audience selection.
    if(!packId&&new URLSearchParams(window.location.search).get("lane")==="KIDS") setLane("KIDS");
  },[]);

  useEffect(()=>{
    let alive=true;
    setRun(null);setRound(null);setError("");setFeedback("");setMedia({});
    setCombo({current:0,best:0});setChanceError("");
    setSyncState("idle");setSyncError("");setConfirmedRunId(null);
    setRemainingClues(null);setReviewOpen(false);setReviewBusy(false);setReviewError("");
    setChapterIntro(null);
    chapterStartsRef.current=null;
    if(!packId)void request("/runs?limit=5").then(value=>{if(alive)setMyHistory(value.items||[])}).catch(()=>{});
    return ()=>{alive=false;};
  },[lane,locale,packId]);

  useEffect(()=>{
    if(!run||run.status!=="FINISHED"||round)return;
    // Local completion is not server completion. Wait until /sync confirms
    // FINISHED before fetching ratings, otherwise the API correctly returns 409.
    if(run.mode!=="INFINITE"&&confirmedRunId!==run.runId)return;
    let alive=true;
    setRatingBusy(true);setRatingError("");
    void request("/runs/"+run.runId+"/feedback","POST",{runToken:run.runToken})
      .then(data=>{if(alive)setQuestionsToRate(data.items??[]);})
      .catch(e=>{if(alive)setRatingError(e instanceof Error?e.message:msg("Could not load the questions for review.","평가할 문제를 불러오지 못했어요."));})
      .finally(()=>{if(alive)setRatingBusy(false);});
    return ()=>{alive=false;};
  },[run?.runId,run?.status,run?.mode,round,confirmedRunId]);

  const saveLocal=()=>{
    if(!localBundleRef.current)return;
    const previous=getCachedRun(localBundleRef.current.runId);
    const next={bundle:localBundleRef.current,progress:localProgressRef.current,
      runToken:localRunTokenRef.current};
    // Re-entry or clue reveals must not invalidate already acknowledged results.
    const unchanged=!!previous&&
      JSON.stringify(cachedCompletedResults(previous))===
      JSON.stringify(cachedCompletedResults(next));
    storeCachedRun({...next,synced:unchanged&&previous?.synced===true,
      verified:unchanged&&previous?.verified===true});
    setSyncState("idle");
    setConfirmedRunId(null);
  };
  const syncLocal=async()=>{
    const bundle=localBundleRef.current;
    if(!bundle)return;
    const runId=bundle.runId;
    setSyncState("saving");setSyncError("");
    try {
      // Cached records, not React state, are the source of truth for each POST.
      // The shared queue deduplicates saves and resends if progress changes
      // during a request. The server receipt is authoritative.
      const saved=await syncCachedRun(runId,{force:true});
      if(localBundleRef.current?.runId!==runId)return saved;
      const local=localSummary(Object.values(localProgressRef.current));
      if(saved&&saved.completed>=local.completed){
        setSyncState("saved");
        if(saved.status==="FINISHED"&&local.completed===bundle.questions.length)
          setConfirmedRunId(runId);
      }else if(local.completed>0){
        setSyncState("error");
        setSyncError(msg("Server hasn't confirmed all your results. Please retry.",
          "서버에서 모든 결과 저장을 확인하지 못했어요. 다시 시도해 주세요."));
      }
      return saved;
    }catch(e){
      if(localBundleRef.current?.runId===runId){
        setSyncState("error");
        setSyncError(e instanceof Error?e.message:msg("Could not save your results.",
          "결과 저장에 실패했어요."));
      }
      throw e;
    }
  };
  useEffect(()=>{
    // This also repairs the previous client version, which could incorrectly
    // mark a cache as synced while an older concurrent request overwrote totals.
    // Never delete the cached answers after a retry.
    let active=true;
    const replay=()=>{void recoverCachedRuns().then(report=>{
      if(!active||!localBundleRef.current)return;
      // The current run is independently confirmed through syncLocal.
      if(report.failed)console.warn("[QuizDip] Some saved runs are still pending recovery");
    }).catch(()=>{});};
    replay();window.addEventListener("online",replay);
    return ()=>{active=false;window.removeEventListener("online",replay);};
  },[]);
  const loadLocalMedia=(r:RunInfo,position:number,ids:string[])=>{
    void Promise.all([...new Set(ids)].filter(Boolean).map(async mediaId=>{
      try{
        const asset=await request("/runs/"+r.runId+"/local-media","POST",
          {runToken:r.runToken,position,mediaId});
        setMedia(prev=>({...prev,[mediaId]:asset}));
      }catch{/* A missing media file does not block gameplay. */}
    }));
  };
  const showRound=useCallback(async (r:RunInfo) => {
    setChapterIntro(null);
    setRemainingClues(null);setReviewOpen(false);setReviewError("");
    if(r.mode!=="INFINITE"){
      localRunTokenRef.current=r.runToken;
      if(packId)try{sessionStorage.setItem("quizdip-pack-run:"+packId+":"+locale,JSON.stringify(r));}catch{}
      let bundle=localBundleRef.current;
      if(!bundle||bundle.runId!==r.runId){
        let stored:LocalSaved|null=null;
        try{stored=JSON.parse(localStorage.getItem(localKey(r.runId))||"null");}catch{}
        if(stored?.bundle?.runId===r.runId && Array.isArray(stored.bundle.questions)){
          bundle=stored.bundle;localProgressRef.current=stored.progress??{};
        }else{
          const data=await request("/runs/"+r.runId+"/bundle","POST",{runToken:r.runToken});
          bundle={runId:r.runId,questions:data.questions};localProgressRef.current={};
          for(const entry of data.progress??[])localProgressRef.current[entry.position]=entry;
        }
        localBundleRef.current=bundle;
      }
      const questions=bundle.questions;
      // The first unfinished question is also correct after a browser restart.
      const position=questions.findIndex(q=>
        !localProgressRef.current[q.position] || localProgressRef.current[q.position].status==="ACTIVE");
      const summary=localSummary(Object.values(localProgressRef.current));
      const nextRun={...r,completed:summary.completed,score:summary.score,
        solved:summary.solved,failed:summary.failed,
        status:position<0?"FINISHED" as const:"ACTIVE" as const};
      setRun(nextRun);refreshCombo();saveLocal();
      if(position<0){
        if(packId)try{sessionStorage.removeItem("quizdip-pack-run:"+packId+":"+locale);}catch{}
        setRound(null);setFeedback("");setMedia({});void syncLocal().catch(()=>{});return;
      }
      const q=questions[position],p=localProgressRef.current[q.position]??initialLocalProgress(q.clues.length);
      if(packId){
        let freshSections:Chapter[]=[];
        if(chapterStartsRef.current===null){
          try{
            const latest=await request("/packs/"+packId+"?locale="+locale);
            freshSections=latest.sections??[];
            chapterStartsRef.current=freshSections.map(part=>part.start);
          }catch{chapterStartsRef.current=[];}
        }
        if(chapterStartsRef.current.includes(q.position+1)){
          const seenKey="quizdip-chapter-viewed:"+r.runId+":"+q.position;
          let viewed=false;
          try{viewed=sessionStorage.getItem(seenKey)==="yes";}catch{}
          if(!viewed){
            try{
              // Refresh signed image URLs only for a chapter we are actually entering.
              const section=freshSections.find(part=>part.start===q.position+1)??(
                (await request("/packs/"+packId+"?locale="+locale)).sections as Chapter[]
              ).find(part=>part.start===q.position+1);
              if(section)setChapterIntro(section);
            }catch{/* Chapter metadata cannot block a cached playable round. */}
          }
        }
      }
      const next:Round={...nextRun,sessionId:"local:"+q.quizId,
        sessionToken:r.runToken,round:q.position+1,quizId:q.quizId,title:q.title,
        prompt:q.prompt,explanation:q.explanation,promptMediaIds:q.promptMediaIds,
        clues:q.clues.slice(0,p.clueIndex) as unknown as Clue[],clueIndex:p.clueIndex,
        clueCount:q.clues.length,sessionStatus:p.status,canGuess:!p.mustReveal&&p.status==="ACTIVE",
        responseMode:q.answer.responseMode??"text",options:q.answer.options};
      rememberQuiz(next.quizId);setRound(next);setGuess("");setFeedback("");setAnswer("");
      setRoundScore(p.score);setMustReveal(p.mustReveal);setMedia({});
      loadLocalMedia(r,q.position,[...q.promptMediaIds,
        ...q.clues.slice(0,p.clueIndex).map(c=>c.mediaId).filter((id):id is string=>!!id)]);
      void syncLocal().catch(()=>{});
      return;
    }
    const data=await request("/runs/"+r.runId+"/current","POST",
      {runToken:r.runToken,avoidQuizIds:rememberedQuizzes(),locale});
    if(data.status==="FINISHED" && !data.sessionId){
      setRun({...r,...data});setRound(null);setFeedback("");setMedia({});return;
    }
    const next=data as Round;
    rememberQuiz(next.quizId);
    setRun({...r,...data});setRound(next);setGuess("");setFeedback("");setAnswer("");setRoundScore(0);
    setMustReveal(!next.canGuess);setMedia({});
    const ids=[...(next.promptMediaIds||[]),...next.clues.map(c=>c.mediaId).filter((id):id is string=>!!id)];
    void Promise.all([...new Set(ids)].map(async mediaId=>{
      try{const asset=await request("/play/"+next.sessionId+"/media","POST",
        {sessionToken:next.sessionToken,mediaId});
        setMedia(previous=>({...previous,[mediaId]:asset}));}catch{}
    }));
  },[packId,locale]);

  useEffect(()=>{
    if(!packId)return;
    let active=true;
    setMode("PACK");setLane("GENERAL");setPack(null);
    void request("/packs/"+packId+"?locale="+locale).then(value=>{
      if(active)setPack(value);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});
    return ()=>{active=false;};
  },[packId,locale]);

  const bootPack=useCallback(async (key:string,restart=false)=>{
    if(!packId)return;
    setPackStartStatus("loading");setError("");
    const storageKey="quizdip-pack-run:"+packId+":"+locale;
    try {
      // Resume local guest capabilities first; signed-in users can also resume
      // across devices through the idempotent PACK run_start endpoint.
      let saved:RunInfo|null=null;
      if(!restart&&!resumeRunId)try{
        const raw=sessionStorage.getItem(storageKey);
        if(raw){
          const candidate=JSON.parse(raw) as RunInfo;
          if(candidate.mode==="PACK"&&candidate.runId&&candidate.runToken&&
              (!candidate.packId||candidate.packId===packId))saved=candidate;
        }
      }catch{/* Unavailable or malformed browser storage never blocks new play. */}
      if(saved){
        // On transient network errors, keep the saved capability for Retry.
        // Never silently discard progress or create a second guest run.
        await showRound(saved);
      }else{
        const started=await api("/runs","POST",
          {mode:"PACK",lane:"GENERAL",packId,locale,...(restart?{restart:true}:resumeRunId?{resumeRunId}:{})},locale);
        if(packStartKeyRef.current!==key)return;
        await showRound(started);
      }
      if(packStartKeyRef.current===key)setPackStartStatus("ready");
    }catch(e){
      if(packStartKeyRef.current===key){
        setPackStartStatus("error");
        setError(e instanceof Error?e.message:bilingual(locale,"Could not load the quiz pack.","퀴즈팩을 불러오지 못했어요."));
      }
    }
  },[packId,locale,resumeRunId,showRound]);

  useEffect(()=>{
    if(!packId)return;
    const key=packId+":"+locale+":"+(resumeRunId??"");
    // React Strict Mode can run mount effects twice. Only bootstrap once per
    // pack and language, otherwise guest players get duplicate runs.
    if(packStartKeyRef.current===key)return;
    packStartKeyRef.current=key;
    void bootPack(key);
  },[packId,locale,resumeRunId,bootPack]);

  async function start(nextMode:Mode, restart=false) {
    setBusy(true);setError("");setFeedback("");setQuestionsToRate([]);setRatingError("");
    try{
      const value=await request("/runs","POST",{mode:nextMode,lane:packId?"GENERAL":lane,
        ...(nextMode==="PACK"?{packId,restart}:{avoidQuizIds:rememberedQuizzes()}),locale});
      setMode(nextMode);setRun(value);
      await showRound(value);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not start the challenge.","시작할 수 없어요."));}
    finally{setBusy(false);}
  }

  async function reveal() {
    if(!round)return;
    setBusy(true);setError("");
    try{
      if(run?.mode!=="INFINITE"&&localBundleRef.current){
        const q=localBundleRef.current.questions[round.round-1];
        const previous=localProgressRef.current[q.position]??initialLocalProgress(q.clues.length);
        const updated=revealLocalClue(q,previous);
        localProgressRef.current[q.position]=updated;saveLocal();
        setRound({...round,clues:q.clues.slice(0,updated.clueIndex) as unknown as Clue[],
          clueIndex:updated.clueIndex,canGuess:true});
        setMustReveal(false);setFeedback("");setGuess("");
        loadLocalMedia(run!,q.position,[q.clues[updated.clueIndex-1]?.mediaId].filter((v):v is string=>!!v));
      }else{
        await request("/play/"+round.sessionId+"/clue","POST",{sessionToken:round.sessionToken});
        await showRound(run!);setMustReveal(false);
      }
    }catch(e){setError(e instanceof Error?e.message:msg("Could not reveal the next clue.","다음 단서를 열지 못했어요."));}
    finally{setBusy(false);}
  }
  async function submitGuess(selectedAnswer:string) {
    if(!round||!selectedAnswer.trim()||busy||chanceBusy||mustReveal||round.sessionStatus!=="ACTIVE"||submittingRef.current)return;
    submittingRef.current=true;
    setBusy(true);setError("");
    try{
      let result:any;
      if(run?.mode!=="INFINITE"&&localBundleRef.current){
        const q=localBundleRef.current.questions[round.round-1];
        const attempt=guessLocalAnswer(q,localProgressRef.current[q.position]??initialLocalProgress(q.clues.length),selectedAnswer.trim(),
          streakThrough(q.position-1).current,run?.mode==="PACK"&&run?.scoringVersion===2);
        if(!attempt)return;
        localProgressRef.current[q.position]=attempt.progress;saveLocal();refreshCombo();
        result=attempt.result;
        if(result.status!=="ACTIVE")void syncLocal().catch(()=>{});
      }else result=await request("/play/"+round.sessionId+"/guess","POST",
        {sessionToken:round.sessionToken,guess:selectedAnswer.trim()});
      if(result.status==="ACTIVE"){
        setFeedback(msg("Not quite. Reveal the next clue and try again.","아쉬워요. 다음 단서를 열어서 다시 맞혀 보세요."));
        setMustReveal(true);
      }else{
        setFeedback(result.correct?msg("Correct! 🎉","정답이에요! 🎉"):msg("That's the end of this question.","아쉽지만 이번 문제는 여기까지예요."));
        setAnswer(result.answer||"");setRoundScore(result.score||0);
        setRound({...round,sessionStatus:result.status,
          explanation:result.explanation??round.explanation});
        setRun(previous=>previous?{
          ...previous,completed:previous.completed+1,score:previous.score+(result.score||0),
          solved:(previous.solved||0)+(result.correct?1:0),failed:(previous.failed||0)+(result.correct?0:1),
          status:previous.total!==null&&previous.completed+1>=previous.total?"FINISHED":"ACTIVE"
        }:null);
      }
    }catch(e){setError(e instanceof Error?e.message:msg("Could not check your answer.","정답을 확인하지 못했어요."));}
    finally{submittingRef.current=false;setBusy(false);}
  }

  async function useChance(){
    if(!packId||!run||!round||run.mode!=="PACK"||run.scoringVersion!==2||chanceBusy||busy)return;
    const index=round.round-1;
    const progress=localProgressRef.current[index]??initialLocalProgress(round.clueCount);
    if(progress.chanceHint||progress.hadWrongGuess||progress.status!=="ACTIVE"||mustReveal)return;
    if(!chances?.authenticated||chances.balance<=0)return;
    setChanceBusy(true);setChanceError("");
    try{
      // Advance the server through completed cached rounds before spending scarce chances.
      const receipt=await syncCachedRun(run.runId,{force:true});
      if(receipt&&receipt.completed<index)throw new Error(msg(
        "Save your previous round before using a chance.","이전 문제의 기록 저장 후 찬스를 사용할 수 있어요."));
      const data=await request("/runs/"+run.runId+"/chance","POST",
        {runToken:run.runToken,position:index}) as {hint:ChanceHint;balance:number;chancesUsed:number};
      localProgressRef.current[index]={...progress,chanceHint:data.hint};
      saveLocal();
      setRound(previous=>previous?{...previous}:null);
      setChances(previous=>previous?{...previous,balance:data.balance}:previous);
      setRun(previous=>previous?{...previous,chancesUsed:data.chancesUsed}:null);
      if(data.hint.kind==="remove-choice"&&guess===data.hint.option)setGuess("");
    }catch(e){setChanceError(e instanceof Error?e.message:msg("Couldn't use a chance.","찬스를 사용하지 못했어요."));}
    finally{setChanceBusy(false);}
  }
  async function toggleRemainingClues() {
    if (!round || reviewBusy || round.sessionStatus === "ACTIVE") return;
    if (reviewOpen) { setReviewOpen(false); return; }
    setReviewOpen(true);
    if (remainingClues) return;
    if(run&&run.mode!=="INFINITE"&&localBundleRef.current){
      const q=localBundleRef.current.questions[round.round-1];
      const unseen=q.clues.slice(round.clueIndex) as unknown as Clue[];
      setRemainingClues(unseen);
      loadLocalMedia(run,q.position,unseen.map(c=>c.mediaId).filter((id):id is string=>!!id));
      return;
    }
    setReviewBusy(true); setReviewError("");
    try {
      const result = await request("/play/" + round.sessionId + "/review", "POST",
        { sessionToken: round.sessionToken });
      const unseen = result.clues as unknown as Clue[];
      setRemainingClues(unseen);
      await Promise.all([...new Set(unseen.map(clue => clue.mediaId).filter((id):id is string => !!id))].map(async id => {
        try {
          const asset = await request("/play/" + round.sessionId + "/media", "POST",
            { sessionToken: round.sessionToken, mediaId: id });
          setMedia(previous => ({ ...previous, [id]: asset }));
        } catch { /* Missing or restricted media stays inaccessible. */ }
      }));
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : msg("Could not load the remaining clues.", "남은 단서를 불러오지 못했어요."));
    } finally { setReviewBusy(false); }
  }
  async function nextRound(){
    if(!run)return;
    setBusy(true);setError("");
    try{await showRound(run);}
    catch(e){setError(e instanceof Error?e.message:msg("Could not load the next question.","다음 문제를 불러오지 못했어요."));}
    finally{setBusy(false);}
  }
  async function finishInfinite(){
    if(!run)return;
    setBusy(true);setError("");
    try{
      const result=await request("/runs/"+run.runId+"/finish","POST",{runToken:run.runToken,confirm:true});
      setRun({...run,...result});setRound(null);
    }catch(e){setError(e instanceof Error?e.message:msg("Could not finish your game.","종료할 수 없어요."));}
    finally{setBusy(false);}
  }

  const isDone=!!round&&round.sessionStatus!=="ACTIVE";
  const activeHint:ChanceHint|undefined=round?localProgressRef.current[round.round-1]?.chanceHint:undefined;
  const activeProgress=round?localProgressRef.current[round.round-1]:undefined;
  const answerForChance=round?localBundleRef.current?.questions[round.round-1]?.answer:undefined;
  const chanceEligible=round?.responseMode==="multiple-choice"?(round.options?.length??0)>=3:
    Boolean(answerForChance&&[...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(answerForChance.canonical)]
      .filter(s=>/[\\p{L}\\p{N}]/u.test(s.segment)).length>=3);
  const comboEnabled=!!packId&&run?.mode==="PACK"&&run.scoringVersion===2;
  const hintMask=activeHint?.kind==="reveal-letter"&&localBundleRef.current&&round
    ?[...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(
      localBundleRef.current.questions[round.round-1]?.answer.canonical??"")].map((s,i)=>
        i===activeHint.index?activeHint.character:/\s/u.test(s.segment)?s.segment:"□").join(""):null;
  const remainingCount=round?Math.max(0,round.clueCount-round.clueIndex):0;
  const endReached=!!run&&(run.status==="FINISHED")&&(!round||isDone);
  const scoreReview=[...(pack?.scoreReviews??[])].filter(review=>run&&run.score>=review.minimumScore).at(-1);

  // Keep a physical-keyboard player in the answer field after each new clue/round,
  // without opening the virtual keyboard unexpectedly on a touch device.
  useEffect(()=>{
    if(!round||isDone||busy||mustReveal||round.responseMode==="multiple-choice")return;
    if(window.matchMedia("(pointer: fine)").matches){
      answerInputRef.current?.focus({preventScroll:true});
    }
  },[round?.quizId,round?.clueIndex,round?.responseMode,isDone,busy,mustReveal]);

  useEffect(()=>{
    function handleKeyboard(event:KeyboardEvent) {
      // Never interpret IME composition or a held key as a game action.
      if(event.repeat||event.isComposing||event.keyCode===229||
         event.altKey||event.shiftKey||busy||!round)return;
      if(chapterIntro){
        if(event.key==="Enter"&&!event.ctrlKey&&!event.metaKey){
          event.preventDefault();
          try{sessionStorage.setItem("quizdip-chapter-viewed:"+run?.runId+":"+(round.round-1),"yes");}catch{}
          setChapterIntro(null);
        }
        return;
      }
      if(!isDone&&!mustReveal&&round.responseMode==="multiple-choice"&&round.options){
        const index=answerShortcutIndex(event);
        const target=event.target;
        const editing=target instanceof HTMLElement &&
          !!target.closest('input,textarea,select,audio,video,[contenteditable="true"],[role="textbox"]');
        if(index!==null&&index<round.options.length&&!editing){
          event.preventDefault();
          const option=round.options[index];
          if(activeHint?.kind==="remove-choice"&&option===activeHint.option)return;
          setGuess(option);
          // Number shortcuts select only. Enter submits as it does for text answers.
          // Move focus from an older choice button to avoid reactivating that button.
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
        if(focusedChoice&&round.options?.[Number(focusedChoice.dataset.quizdipChoice)]!==guess)return;
        if(interactive&&interactive!==answerInputRef.current&&!focusedChoice)return;
      }
      // Ctrl/Command+Enter advances without submitting an answer.
      if(event.ctrlKey||event.metaKey){
        if(isDone){event.preventDefault();void nextRound();}
        else if(round.clueIndex<round.clueCount){event.preventDefault();void reveal();}
        return;
      }
      if(isDone){event.preventDefault();void nextRound();return;}
      if(!mustReveal&&guess.trim()){
        if(target!==answerInputRef.current){
          event.preventDefault();guessFormRef.current?.requestSubmit();
        }
      }else if(round.clueIndex<round.clueCount){
        event.preventDefault();void reveal();
      }
    }
    window.addEventListener("keydown",handleKeyboard);
    return ()=>window.removeEventListener("keydown",handleKeyboard);
  },[round,isDone,busy,mustReveal,guess,chapterIntro,run?.runId,activeHint]);

  return <main className="container inner-page play-experience">
    {packId?<div className="play-pack-intro">
      <span className="eyebrow">QUIZDIP · PLAY</span>
      <h1>{pack?.title||msg("Quiz pack","퀴즈팩")}</h1>
    </div>:<div className="play-intro">
      <span className="eyebrow">QUIZDIP · PLAY</span>
      <h1>{msg("Discover and play at your pace.","흥미로운 퀴즈를 발견하고 자유롭게 플레이하세요.")}</h1>
      <p className="lead">{msg("Try five quick questions, keep exploring at random, or find quiz packs in Discover.","가볍게 랜덤 5문제로 시작하거나 계속 풀어보세요. Discover에서 다양한 퀴즈팩을 탐색할 수도 있어요.")}</p>
    </div>}

    {!packId&&<div className="lane-picker" role="group" aria-label={msg("Play audience","플레이 대상 선택")}>
      <button type="button" disabled={busy} aria-pressed={lane==="GENERAL"}
        className={"lane-choice "+(lane==="GENERAL"?"active":"")} onClick={()=>setLane("GENERAL")}>{msg("General play","일반 플레이")}</button>
      <button type="button" disabled={busy} aria-pressed={lane==="KIDS"}
        className={"lane-choice "+(lane==="KIDS"?"active":"")} onClick={()=>setLane("KIDS")}>{msg("Kids play","어린이 플레이")}</button>
    </div>}

    {packId&&packStartStatus==="loading"&&<section className="play-pack-status" role="status">
      {msg("Preparing your quiz pack…","퀴즈팩을 준비하고 있어요…")}
    </section>}
    {packId&&packStartStatus==="error"&&<section className="play-pack-status" role="alert">
      <p>{error||msg("Could not load the quiz pack.","퀴즈팩을 불러오지 못했어요.")}</p>
      <div className="actions">
        <button type="button" className="btn btn-primary"
          onClick={()=>void bootPack(packId+":"+locale+":"+(resumeRunId??""))}>{msg("Try again","다시 시도")}</button>
        <button type="button" className="btn btn-outline" onClick={()=>{
          try{sessionStorage.removeItem("quizdip-pack-run:"+packId+":"+locale);}catch{}
          localBundleRef.current=null;localProgressRef.current={};
          void bootPack(packId+":"+locale+":"+(resumeRunId??""),true);
        }}>{msg("Start a new game","새로 시작")}</button>
        <Link href={localizeHref("/packs/"+packId,locale)}>{msg("Back to pack details","퀴즈팩 상세 보기")}</Link>
      </div>
    </section>}

    {!run && !packId && <>
      <section className="play-practice">
        <h2>{msg("Free play","자유 플레이")}</h2>
        <div className="cards">
          <article className="feature-card">
            <span className="symbol mint">5</span><h3>{msg("Quick start · five questions","가볍게 시작 · 랜덤 5문제")}</h3>
            <p>{msg("Choose five quizzes you haven't seen. Finish and unlock five more.","아직 보지 않은 다섯 문제를 골라요. 완료하면 새로운 다섯 문제를 더 즐길 수 있어요.")}</p>
            <button className="btn btn-primary" disabled={busy} onClick={()=>void start("RANDOM_FIVE")}>{msg("Start five quizzes →","5문제 시작하기 →")}</button>
          </article>
          <article className="feature-card">
            <span className="symbol yellow">∞</span><h3>{msg("Continuous random play","랜덤 연속 플레이")}</h3>
            <p>{msg("Keep playing until you run out of new questions, with no repeats.","원한다면 계속 풀 수 있어요. 새로운 문제가 소진되면 반복 없이 끝나요.")}</p>
            <button className="btn btn-outline" disabled={busy} onClick={()=>void start("INFINITE")}>{msg("Continue playing","이어 풀기")}</button>
          </article>
        </div>
      </section>
      <p className="play-discover-link"><Link href={localizeHref("/packs", locale)}>{msg("Explore complete quiz packs →","퀴즈팩 전체 플레이 →")}</Link> · <Link href={localizeHref("/discover", locale)}>{msg("Explore individual quizzes →","개별 문제 둘러보기 →")}</Link></p>

      {myHistory.length>0&&<section className="play-recent">
        <h2>{msg("My recent games","최근 내 기록")}</h2>
        <p><Link href={localizeHref("/account/results",locale)}>{msg("All results and reshare →","전체 기록과 다시 공유 →")}</Link></p>
        <div className="recent-results">
          {myHistory.map(item=><p key={item.runId}>
            {item.mode==="PACK"?msg("Quiz pack","퀴즈팩"):item.mode==="INFINITE"?msg("Continuous play","연속 플레이"):msg("Quick five","랜덤 5문제")}
            {" · "}{item.score}{msg(" pts · ","점 · ")}{item.completed}{msg(" quizzes · ","문제 ")}{item.status==="FINISHED"?msg("Finished","완료"):msg("In progress","진행 중")}
            {item.mode==="PACK"&&item.packId&&<> · <Link href={localizeHref("/packs/"+item.packId+"/play",locale)}>{msg("Resume pack →","퀴즈팩 이어 풀기 →")}</Link></>}
          </p>)}
        </div>
      </section>}
    </>}

    {run&&packId&&packStartStatus==="ready"&&chapterIntro&&<section className="play-panel play-chapter-intro" aria-live="polite">
      <div className="small-tag">QUIZDIP · {msg("CHAPTER INTRODUCTION","파트 소개")}</div>
      <p className="muted">{msg("Starting at question ","시작 문제 ")}{chapterIntro.start}</p>
      <h2>{chapterIntro.title}</h2>
      {chapterIntro.mediaUrl&&<img className="round-media" src={chapterIntro.mediaUrl} alt={chapterIntro.title} style={{maxHeight:420,objectFit:"contain",borderRadius:16}}/>}
      {chapterIntro.description&&<p className="lead" style={{whiteSpace:"pre-wrap"}}>{chapterIntro.description}</p>}
      <button type="button" className="btn btn-primary" onClick={()=>{
        try{sessionStorage.setItem("quizdip-chapter-viewed:"+run.runId+":"+((round?.round??1)-1),"yes");}catch{}
        setChapterIntro(null);
      }}>{msg("Start chapter →","이 파트 시작하기 →")}</button>
    </section>}
    {run&&(!packId||packStartStatus==="ready")&&!chapterIntro&&<section className="play-panel play-live" aria-live="polite">
      <div className="play-top">
        <span className="small-tag">{mode==="PACK"?msg("Quiz pack","퀴즈팩"):mode==="RANDOM_FIVE"?msg("Quick five","랜덤 5문제"):msg("Continuous play","연속 플레이")}</span>
        <span className="clue-count">{run.completed}{msg(" quizzes finished · ","문제 완료 · ")}{run.score}{msg(" pts","점")}</span>
        {comboEnabled&&<div className="quizdip-combo-bar" aria-live="polite">
          <span className={combo.current>=3?"quizdip-combo is-hot":"quizdip-combo"}>🔥 {combo.current} COMBO
            {combo.current===3?" · GREAT!":combo.current===5?" · AMAZING!":combo.current===10?" · LEGENDARY!":""}</span>
          <span className="quizdip-chance-count">🎟️ {chances?.authenticated?chances.balance:"—"}</span>
        </div>}
      </div>
      {round?<>
        <div className="round-progress"><span>{msg("Question ","문제 ")}{round.round}{run.total?" / "+run.total:""} </span>
          {round.clueCount>0&&<span>{msg("Clue ","단서 ")}{round.clueIndex} / {round.clueCount}</span>}</div>
        <RatingBadge ratings={round.ratings}/>
        <h2 className="quiz-question-prompt">{round.prompt}</h2>
        {!!round.promptMediaIds?.length&&<div className="clue-media-list">
          {round.promptMediaIds.map(id=><div key={id}>{media[id]?<MediaPart item={media[id]}/>:<p className="muted">{msg("Couldn't load the media.","미디어를 불러올 수 없어요.")}</p>}</div>)}
        </div>}
        <ol className="clue-list">
          {round.clues.map((clue,i)=>{
            const stage=activeImageStage(round.clues,i);
            if(!stage&&!clue.text&&!clue.map)return null;
            return <li key={clue.id||i} style={{counterSet:`clue ${i}`}}>
            {clue.text&&<p>{clue.text}</p>}
            {clue.type==="map"&&clue.map&&<div className="map-clue">
              <span>{msg("Map clue · latitude ","지도 단서 · 위도 ")}{clue.map.latitude}{msg(", longitude ",", 경도 ")}{clue.map.longitude}</span>
              <a href={`https://www.openstreetmap.org/?mlat=${clue.map.latitude}&mlon=${clue.map.longitude}#map=${clue.map.zoom||8}/${clue.map.latitude}/${clue.map.longitude}`}
                target="_blank" rel="noopener noreferrer">{msg("View map ↗","지도에서 보기 ↗")}</a>
            </div>}
            {stage?.mediaId&&(media[stage.mediaId]?<MediaPart item={media[stage.mediaId]} reveal={stage.type==="image-reveal"?stage.reveal:undefined}/>:<p className="muted">{msg("Media is unavailable.","미디어가 제공되지 않았어요.")}</p>)}
          </li>})}
        </ol>
        {!isDone&&round.clueIndex<round.clueCount&&
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void reveal()}>
            {msg("Reveal another clue","단서 하나 더 보기")}</button>}
        {!isDone&&<form ref={guessFormRef} className="guess-form" tabIndex={-1} onSubmit={e=>{e.preventDefault();void submitGuess(guess);}}
          onKeyDown={e=>{if(e.key==="Enter"&&(e.nativeEvent.isComposing||e.nativeEvent.keyCode===229))e.preventDefault();}}>
          <label id="quizdip-answer-label">{msg("What's your answer?","정답은 무엇일까요?")}</label>
          {round.responseMode==="multiple-choice"&&round.options?.length?
            <div className="guess-option-grid" role="group" aria-labelledby="quizdip-answer-label">
              {round.options.map((option,index)=><button type="button" key={option}
                className={"guess-option"+(guess===option?" selected":"")+(activeHint?.kind==="remove-choice"&&activeHint.option===option?" quizdip-option-eliminated":"")} aria-pressed={guess===option} data-quizdip-choice={index}
                disabled={busy||chanceBusy||mustReveal||(activeHint?.kind==="remove-choice"&&activeHint.option===option)} onClick={()=>setGuess(option)}>
                <span className="guess-option-letter">{index+1}</span>{option}
              </button>)}
            </div>:
            <input ref={answerInputRef} className="guess-input" id="quizdip-answer" value={guess} onChange={e=>setGuess(e.target.value)}
              aria-labelledby="quizdip-answer-label" autoComplete="off" placeholder={msg("Enter your answer","정답을 입력해 보세요")}
              maxLength={200} disabled={busy||chanceBusy||mustReveal}/>}
          {comboEnabled&&hintMask&&<p className="quizdip-letter-hint" role="status" aria-label={msg("One revealed answer letter","정답 한 글자 공개")}>{hintMask}</p>}
          {comboEnabled&&chanceEligible&&chances!==null&&!activeHint&&!activeProgress?.hadWrongGuess&&!mustReveal&&<div className="quizdip-chance-actions">
            {chances?.authenticated?<button type="button" className="btn btn-outline" disabled={busy||chanceBusy||chances.balance===0||
              (run.chancesUsed??0)>=2||(round.responseMode==="multiple-choice"?(round.options?.length??0)<3:false)}
              onClick={()=>void useChance()}>{chanceBusy?msg("Using chance…","찬스 사용 중…"):msg("🎟️ Use chance","🎟️ 찬스 사용")}</button>:
              <Link className="btn btn-outline" href={"/sign-in?callbackURL="+encodeURIComponent(localizeHref("/packs/"+packId+"/play",locale))}>
                {msg("🎟️ Sign in for 3 chances","🎟️ 로그인하고 찬스 3개 받기")}</Link>}
            {chances?.authenticated&&<span className="muted">{msg("1 wrong choice or 1 letter · 2 per pack","오답 보기 1개 또는 한 글자 · 팩당 2개")}</span>}
          </div>}
          {chanceError&&<p className="feedback" role="alert">{chanceError}</p>}
          <div className="guess-row">
            <button type="submit" className="btn btn-primary" disabled={busy||chanceBusy||mustReveal||!guess.trim()}>
              {msg("Check answer","정답 확인")}</button>
          </div>
        </form>}
        {feedback&&<div className={"feedback "+(answer&&roundScore>0?"success":"")} role="status">
          {feedback}{answer&&<p>{msg("Answer: ","정답: ")}<strong>{answer}</strong> · {roundScore}{msg(" pts","점")}</p>}
        </div>}
        {isDone&&round.explanation&&<section className="feature-card quiz-answer-explanation" aria-label={msg("Answer explanation","정답 해설")}>
          <h3>{msg("Why this is the answer","정답 해설")}</h3>
          <p style={{whiteSpace:"pre-wrap"}}>{round.explanation}</p>
        </section>}
        {isDone && remainingCount > 0 && <section className="remaining-clue-review">
          <button type="button" className="btn btn-outline" disabled={reviewBusy}
            aria-expanded={reviewOpen} onClick={() => void toggleRemainingClues()}>
            {reviewOpen ? msg("Hide remaining clues", "남은 단서 접기") :
              msg(`View remaining clues (${remainingCount})`, `남은 단서 ${remainingCount}개 보기`)}
          </button>
          {reviewOpen && <>
            {reviewBusy && <p className="muted" role="status">{msg("Loading remaining clues…", "남은 단서를 불러오는 중…")}</p>}
            {reviewError && <p role="alert" className="feedback">{reviewError}</p>}
            {remainingClues && <RemainingClues clues={remainingClues}
              firstClueIndex={round.clueIndex + 1} media={media}/>}
          </>}
        </section>}
        {isDone&&<button type="button" className="btn btn-primary play-next-round" disabled={busy||reviewBusy} onClick={()=>void nextRound()}>
          {endReached?msg("View final results →","최종 결과 보기 →"):msg("Next question →","다음 문제 →")}
        </button>}
        <p className="play-keyboard-help"><span aria-hidden="true">⌨</span>{" "}
          {!isDone&&round.responseMode==="multiple-choice"&&round.options?.length&&<>
            <kbd>1–{round.options.length}</kbd> {msg("Select an answer (number pad too)","숫자키·키패드로 보기 선택")} <span className="shortcut-divider">·</span>{" "}
          </>}
          <kbd>Enter</kbd> {isDone?msg("Next question / results","다음 문제 / 결과 보기"):round.responseMode==="multiple-choice"?msg("Submit selected answer · none: next clue","선택한 답 제출 · 미선택 시 다음 단서"):msg("Check answer · empty field: next clue","정답 확인 · 빈칸이면 다음 단서")} <span className="shortcut-divider">·</span> <kbd>Ctrl/⌘ + Enter</kbd> {isDone?msg("Next","다음"):msg("Reveal next clue","다음 단서")}</p>
      </>:<>
        <div className="round-finish">
          <div className="round-finish-symbol">✦</div>
          <h2>{msg("Challenge complete!","이번 도전 완료!")}</h2>
          <p>{msg("Total ","총 ")}<strong>{run.score}{msg(" pts","점")}</strong> · {run.completed}{msg(" quizzes · ","문제 · ")}{msg("Correct ","정답 ")}{run.solved||0}</p>
          {comboEnabled&&<p className="quizdip-finish-combo">🔥 {msg("Best combo","최고 콤보")} <strong>{combo.best}</strong> · 🎟️ {msg("Chances used","사용한 찬스")} <strong>{run.chancesUsed??0}</strong></p>}
          {run.mode==="PACK"&&pack?.closingMessage&&<section className="feature-card pack-ending-message">
             <h3>{msg("From the creator","제작자의 마무리 글")}</h3>
             <p style={{whiteSpace:"pre-wrap"}}>{pack.closingMessage}</p>
           </section>}
           {run.mode==="PACK"&&scoreReview&&<section className="feature-card pack-score-review">
             <h3>{scoreReview.title}</h3>
             {scoreReview.description&&<p style={{whiteSpace:"pre-wrap"}}>{scoreReview.description}</p>}
           </section>}
           {run.mode!=="INFINITE"&&syncState!=="saved"&&<div className="play-sync-status" role="status">
            <p>{syncState==="saving"
              ?msg("Saving your results to the server…","서버에 결과를 저장하는 중…")
              :syncState==="error"
                ?msg("Result sync needs attention. Your progress is still stored in this browser.",
                  "결과 저장을 다시 시도해야 해요. 플레이 기록은 현재 브라우저에 보관되어 있어요.")
                :msg("Confirming your saved result…","서버 저장 결과를 확인하는 중…")}</p>
            {syncError&&<p className="muted">{syncError}</p>}
            {syncState==="error"&&<button type="button" className="btn btn-outline"
              onClick={()=>void syncLocal().catch(()=>{})}>
              {msg("Retry saving results","결과 저장 다시 시도")}</button>}
          </div>}
          {run.mode==="PACK"&&packId&&run.status==="FINISHED"&&confirmedRunId===run.runId&&<PackResultShare
            packId={packId} title={pack?.title||msg("Quiz pack","퀴즈팩")}
            score={run.score} completed={run.completed} solved={run.solved||0}
            createShareId={async()=>{
              // Recheck before making a public score claim.
              const confirmation=await syncLocal();
              if(confirmation?.status!=="FINISHED")throw new Error("Result not confirmed by server");
              const shared=await request("/runs/"+run.runId+"/share","POST",{runToken:run.runToken});
              return shared.shareId as string;
            }}
            revokeShare={async()=>{
              // The REST DELETE endpoint reads confirmation from the query string.
              const response=await fetch("/api/v1/runs/"+run.runId+"/share",{
                method:"DELETE",credentials:"same-origin",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({confirm:true,runToken:run.runToken})
              });
              if(!response.ok)throw new Error("Could not revoke result share");
            }}/>}
          {run.mode==="PACK"&&packId&&<PackFeedback packId={packId}/>}
          {run.status==="FINISHED"&&<AdSlot placement="PLAY_RESULT" kids={run.lane==="KIDS"||Boolean(pack?.kidsEligible)}/>}
          {run.exhausted&&<p>{msg("You've finished all available new questions. Come back for more.","새로운 문제를 모두 풀었어요. 새 퀴즈가 등록되면 다시 즐겨 주세요.")}</p>}
          <details className="run-rating-review" open={run.mode!=="PACK"}>
            <summary>{run.mode==="PACK"?msg("Optional: rate individual questions","선택: 개별 문제 평가"):msg("Rate finished questions","완료한 문제 평가")}</summary>
            <h3>{msg("How were those quizzes?","방금 풀었던 문제는 어땠나요?")}</h3>
            <p className="muted">{msg("Rate the quizzes after the game to keep the flow uninterrupted. Feedback is optional.","흐름을 끊지 않도록 게임이 끝난 뒤 모았어요. 평가는 선택 사항이에요.")}</p>
            {ratingBusy&&<p role="status">{msg("Loading questions to rate…","평가할 문제를 불러오는 중…")}</p>}
            {ratingError&&<p className="feedback" role="alert">{ratingError}</p>}
            {run.mode!=="INFINITE"&&confirmedRunId!==run.runId&&<p className="muted" role="status">{msg("You can rate questions after your results are saved.","결과 저장이 완료되면 개별 문제를 평가할 수 있어요.")}</p>}
             {!ratingBusy&&!ratingError&&questionsToRate.length===0&&(run.mode==="INFINITE"||confirmedRunId===run.runId)&&<p className="muted">{msg("No completed questions to rate yet.","평가할 완료 문제가 없어요.")}</p>}
            {questionsToRate.map(q=><div className="run-rating-row" key={q.quizId}>
              <div className="run-rating-question"><strong>{q.round}. {q.title}</strong>
                <RatingBadge ratings={q.ratings}/></div>
              <RatingButtons quizId={q.quizId} locale={locale} initialRating={q.myRating} access={q.ratingAccess}
                onSaved={(ratings,value)=>setQuestionsToRate(old=>old.map(row=>row.quizId===q.quizId?{...row,ratings,myRating:value}:row))}/>
              {q.isTranslation&&<div className="translation-quality-feedback">
                <p className="muted">{locale==="ko"?"번역 품질":"Translation quality"}</p>
                <RatingButtons quizId={q.quizId} locale={locale} kind="TRANSLATION"
                  initialRating={q.myTranslationRating??null} access={q.ratingAccess}
                  onSaved={(_rating,value)=>setQuestionsToRate(old=>old.map(row=>row.quizId===q.quizId?{...row,myTranslationRating:value}:row))}/>
              </div>}
            </div>)}
            {questionsToRate.some(q=>q.ratingAccess==="SIGN_IN")&&<RatingSignIn destination={localizeHref(packId?"/packs/"+packId+"/play":"/play", locale)}/>}
          </details>
          {run.mode==="PACK"&&<button type="button" className="btn btn-outline" onClick={()=>void start("PACK",true)} disabled={busy}>{msg("Play this pack again","퀴즈팩 다시 풀기")}</button>}
          {run.mode==="RANDOM_FIVE"&&<button type="button" className="btn btn-primary"
            disabled={busy} onClick={()=>void start("RANDOM_FIVE")}>{msg("Play five more →","새로운 5문제 더 풀기 →")}</button>}
        </div>
      </>}
      <div className="play-bottom">
        {run.mode==="INFINITE"&&!endReached&&
          <button type="button" className="text-button" disabled={busy} onClick={()=>void finishInfinite()}>{msg("End continuous play","무한 플레이 끝내기")}</button>}
        {packId?<Link className="text-button" href={localizeHref("/packs/"+packId,locale)}>{msg("Back to pack details","퀴즈팩 상세 보기")}</Link>:
        <button type="button" className="text-button" onClick={()=>{setRun(null);setRound(null);setFeedback("");setError("");}}>{msg("Back to game modes","모드 선택으로 돌아가기")}</button>}
      </div>
    </section>}

    {error&&(!packId||packStartStatus!=="error")&&<p className="feedback" role="alert">{error}</p>}

    {lane==="KIDS"&&<p className="muted">{msg("Kids play only includes safety-approved questions and never displays public individual rankings.","어린이 모드는 플랫폼에서 안전성을 확인한 문제만 제공하고, 공개 개인 순위는 표시하지 않아요.")}</p>}
    <div className="play-bottom"><Link href={localizeHref("/discover", locale)}>{msg("Discover more quizzes →","다른 퀴즈 둘러보기 →")}</Link><Link href={localizeHref("/studio", locale)}>{msg("Create your own quiz →","퀴즈 만들기 →")}</Link></div>
  </main>;
}
