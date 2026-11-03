"use client";
import Link from "next/link";
import {useEffect} from "react";
import {localizeHref} from "../i18n/core";
import {trackGrowth} from "../lib/growth-tracking";
type Featured={id:string;title:string;prompt:string};
export default function HomeFeaturedQuiz({locale,quiz}:{locale:"en"|"ko";quiz:Featured|null}){
  const ko=locale==="ko",url=(path:string)=>localizeHref(path,locale);
  useEffect(()=>trackGrowth("landing",locale,"home"),[locale]);
  return <div className="home-first-quiz" aria-labelledby="home-first-quiz-heading">
    <span className="eyebrow">{ko?"🎯 지금 바로 한 문제":"🎯 ONE QUESTION. RIGHT NOW."}</span>
    <h2 id="home-first-quiz-heading">{quiz?.prompt||
      (ko?"당신의 첫 번째 퀴즈가 기다리고 있어요.":"Your first quiz is waiting.")}</h2>
    <p>{ko?"로그인 없이 시작 · 답을 맞히고 해설 확인 · 마음에 들면 더 도전":
      "No sign-up to start · Make a guess · Discover the explanation"}</p>
    <div className="actions">
      {quiz&&<Link className="btn btn-primary" href={url("/play/"+quiz.id+"?src=home")}
        onClick={()=>trackGrowth("teaser_click",locale,"home")}>
        {ko?"이 문제 맞혀보기 →":"Take a guess →"}
      </Link>}
      <Link className={quiz?"btn btn-outline":"btn btn-primary"} href={url("/play?quick=1&src=home")}
        onClick={()=>trackGrowth("teaser_click",locale,"home")}>
        {ko?"랜덤 5문제 도전":"Play a quick five"}
      </Link>
    </div>
  </div>;
}
