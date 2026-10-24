"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useLocale} from "../../../src/i18n/provider";
import {localizeHref} from "../../../src/i18n/core";
type Pick={id:string;type:"QUIZ"|"PACK";title:string;description:string;creator:string;
 headline:string;editorialDescription:string;placement:"HERO"|"ROW";
 questionCount:number;orderMode?:string;featureId:string};
export default function EditorialHighlights({onSelected}:{onSelected:(keys:string[])=>void}){
 const locale=useLocale(),ko=locale==="ko";
 const [items,setItems]=useState<Pick[]>([]);
 useEffect(()=>{
  let alive=true;
  void fetch("/api/v1/editorial?locale="+locale+"&limit=10",{cache:"no-store"})
   .then(async r=>r.ok?(await r.json()).data:null)
   .then(v=>{if(alive){const picks=(v?.items??[]) as Pick[];setItems(picks);onSelected(picks.map(i=>i.type+":"+i.id));}}).catch(()=>{if(alive)onSelected([])});
  return ()=>{alive=false}
 },[locale,onSelected]);
 if(!items.length)return null;
 const hero=items.filter(i=>i.placement==="HERO");
 const rest=items.filter(i=>i.placement!=="HERO");
 function link(i:Pick){return localizeHref(i.type==="PACK"?"/packs/"+i.id:"/play/"+i.id,locale)}
 return <section aria-label={ko?"운영자 추천 퀴즈":"Editor's Picks"} className="discover-editorial">
  <div className="discover-results-head">
    <h2>✨ {ko?"운영자 추천":"Editor's Picks"}</h2>
    <p className="muted">{ko?"운영자가 직접 선정한 콘텐츠 · 실제 인기 순위와 별개예요.":"Curated by the team · separate from organic popularity."}</p>
  </div>
  <div className="cards">
   {hero.map(item=><article className="feature-card" key={item.featureId}>
     <span className="small-tag">{ko?"운영자 추천 · 대표":"Editor's Pick · Featured"}</span>
     <h3>{item.headline||item.title}</h3>
     <p>{item.editorialDescription||item.description}</p>
     <p className="muted">{item.type==="PACK"?(ko?"퀴즈팩":"Quiz pack"):(ko?"개별 문제":"Question")}
       {" · "}{item.creator}{" · "}{item.questionCount} {ko?"문제":"questions"}</p>
     <Link href={link(item)} className="btn btn-primary">{ko?"탐색하기 →":"Explore →"}</Link>
   </article>)}
  </div>
  {!!rest.length&&<div className="discover-grid">{rest.map(item=><article className="feature-card discover-card" key={item.featureId}>
   <span className="small-tag">{ko?"운영자 추천":"Editor's Pick"}</span>
   <h3>{item.headline||item.title}</h3><p>{item.editorialDescription||item.description}</p>
   <p className="muted">{item.creator}</p>
   <Link href={link(item)} className="btn btn-outline">{ko?"풀어보기 →":"Play →"}</Link>
  </article>)}</div>}
 </section>;
}
