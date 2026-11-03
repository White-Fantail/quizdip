"use client";
import {useState} from "react";
import {localizeHref} from "../i18n/core";
import {trackGrowth} from "../lib/growth-tracking";
export default function QuickResultShare({locale,solved,completed}:{locale:"en"|"ko";solved:number;completed:number}){
  const ko=locale==="ko", [copied,setCopied]=useState(false),[error,setError]=useState("");
  async function share(){
    const url=window.location.origin+localizeHref("/play?quick=1&src=social",locale);
    const message=ko?`QuizDip 5문제 도전! ${completed}문제 중 ${solved}문제 성공. 당신은 몇 개 맞힐까요?`:
      `I got ${solved}/${completed} on QuizDip's quick challenge. Can you beat me?`;
    setError("");
    try{
      if(navigator.share){await navigator.share({url});trackGrowth("share",locale);return;}
      await navigator.clipboard.writeText(message+"\n"+url);
      setCopied(true);trackGrowth("share",locale);
    }catch(e){
      if(e instanceof Error&&e.name==="AbortError")return;
      try{await navigator.clipboard.writeText(message+"\n"+url);setCopied(true);trackGrowth("share",locale);}
      catch{setError(ko?"링크를 복사할 수 없어요. 주소창에서 복사해 주세요.":"Could not copy. Please copy the page link from your address bar.");}
    }
  }
  return <div className="home-quick-share">
    <p><strong>{ko?"친구는 얼마나 맞힐까요?":"How many can your friends solve?"}</strong></p>
    <button type="button" className="btn btn-primary" onClick={()=>void share()}>
      {copied?(ko?"도전 링크 복사됨 ✓":"Challenge link copied ✓"):(ko?"친구에게 도전장 보내기":"Challenge a friend")}
    </button>
    {error&&<p className="muted" role="alert">{error}</p>}
  </div>;
}
