"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {localizeHref} from "../i18n/core";

type Suggestion={id:string;title:string;questionCount:number;reason:"CURATED"|"RELATED"|"POPULAR"};
export default function RelatedPacks({packId,locale,runId,runToken}:{packId:string;locale:"en"|"ko";runId?:string;runToken?:string}){
  const [items,setItems]=useState<Suggestion[]>([]);
  const ko=locale==="ko";
  function track(kind:"IMPRESSION"|"CLICK",targetPackIds:string[]){
    if(!runId||!runToken||!targetPackIds.length)return;
    void fetch("/api/v1/runs/recommendations",{method:"POST",credentials:"same-origin",keepalive:true,
      headers:{"Content-Type":"application/json"},body:JSON.stringify({runId,runToken,kind,targetPackIds})}).catch(()=>{});
  }
  useEffect(()=>{
    const controller=new AbortController();
    setItems([]);
    void fetch("/api/v1/packs/"+encodeURIComponent(packId)+"/recommendations?locale="+locale,{
      credentials:"same-origin",cache:"no-store",signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error("Unavailable");return (await r.json()).data;})
      .then(data=>{if(!controller.signal.aborted){const rows=(data.items??[]) as Suggestion[];
        setItems(rows);
        if(runId&&runToken&&rows.length)void fetch("/api/v1/runs/recommendations",{
          method:"POST",credentials:"same-origin",keepalive:true,
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({runId,runToken,kind:"IMPRESSION",targetPackIds:rows.map(item=>item.id)})
        }).catch(()=>{});
      }}).catch(()=>{});
    return ()=>controller.abort();
  },[packId,locale,runId,runToken]);
  if(!items.length)return null;
  return <section className="related-packs" aria-label={ko?"관련 퀴즈팩":"Related quiz packs"}>
    <header><span className="small-tag">QUIZDIP · {ko?"다음 도전":"UP NEXT"}</span>
      <h3>{ko?"이 퀴즈가 재미있었다면?":"Enjoyed this quiz? Try these next!"}</h3></header>
    <div className="related-pack-grid">
      {items.map(item=><Link className="related-pack-card" key={item.id}
        href={localizeHref("/packs/"+item.id+"/play",locale)} onClick={()=>track("CLICK",[item.id])}>
        <span className="related-pack-art" aria-hidden="true">✦</span>
        <span className="related-pack-details"><strong>{item.title}</strong>
          <small>{item.questionCount}{ko?"문제":" questions"} · {item.reason==="CURATED"?(ko?"제작자 추천":"Creator pick"):item.reason==="RELATED"?(ko?"관련 퀴즈":"Related"):(ko?"인기 퀴즈":"Popular")}</small>
          <b>{ko?"바로 도전하기 →":"Play next →"}</b>
        </span>
      </Link>)}
    </div>
  </section>;
}
