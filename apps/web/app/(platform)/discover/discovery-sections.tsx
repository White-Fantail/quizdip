"use client";
import Link from "next/link";
import KidsPackBadge from "../../../src/components/kids-pack-badge";
import { useEffect, useState } from "react";
import { useLocale } from "../../../src/i18n/provider";
import { loadDiscoverySections } from "./discovery-client";
import { localizeHref } from "../../../src/i18n/core";
import { uniqueDiscoveryRows } from "./discovery-layout";

type Card={id:string;type:"PACK"|"QUIZ";title:string;subtitle:string;creator:string;
 questionCount:number;orderMode?:string;started:number;completed:number;
 difficultyPercent:number|null;kidsEligible?:boolean;ratings:{total:number;positivePercent:number|null}};
type Section={key:"surprise"|"trending"|"popular"|"highly_rated"|"difficult"|"new";
 items:Card[];basis:string};
const names:Record<Section["key"],{en:string;ko:string;icon:string}>={
 surprise:{en:"A little something different",ko:"뜻밖의 퀴즈 발견",icon:"🎲"},
 trending:{en:"Trending now",ko:"지금 인기",icon:"📈"},
 popular:{en:"Popular to play",ko:"많이 풀어본 콘텐츠",icon:"✨"},
 highly_rated:{en:"Highly rated",ko:"평가가 좋은 콘텐츠",icon:"👍"},
 difficult:{en:"Challenge yourself",ko:"어려운 퀴즈에 도전",icon:"🔥"},
 new:{en:"New discoveries",ko:"새로운 발견",icon:"🌱"}
};

export default function DiscoverySections({rotation,onRemix,excludedIds=[]}:{
 rotation:number;onRemix:()=>void;excludedIds?:string[];
}){
 const locale=useLocale(),ko=locale==="ko";
 const [sections,setSections]=useState<Section[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
   let live=true;setLoading(true);setError("");setSections([]);
   void loadDiscoverySections(locale,rotation)
    .then(data=>{if(live)setSections(data.sections??[]);})
    .catch(e=>{if(live)setError(String(e));})
    .finally(()=>{if(live)setLoading(false)});
   return ()=>{live=false};
 },[locale,rotation]);
 const eligible=sections.filter(s=>s.items.length && Object.prototype.hasOwnProperty.call(names,s.key));
 // An item appears only once in the visible dashboard, including editorial
 // and featured-pack areas. Do not use the deduplicated order for ranking claims.
 const present=uniqueDiscoveryRows(eligible,excludedIds,3);
 // Keep an empty organic ranking from pushing the actual catalog down the page.
 if (!loading && !error && !present.length) return null;
 return <section aria-label={ko?"추천 및 인기 퀴즈":"Discover recommended quizzes"} className="discovery-dashboard">
  <div className="discover-results-head discovery-dashboard-heading">
    <div>
      <h2>{ko?"둘러보다 만나는 발견":"Find your next discovery"}</h2>
      <p className="muted">{ko?"색다른 추천은 매일 바뀌고, 인기 순위는 실제 플레이 기록을 사용해요.":"Fresh mixes rotate daily; rankings use verified plays and ratings."}</p>
    </div>
    <button type="button" className="discover-remix-button" onClick={onRemix} disabled={loading}>
      <span aria-hidden="true">🎲</span> {ko?"다른 조합 보기":"Mix it up"}
    </button>
  </div>
  {loading&&<p className="muted" role="status">{ko?"새로운 콘텐츠를 찾아보는 중…":"Finding a new mix…"}</p>}
  {error&&<p className="muted" role="status">{ko?"추천 정보를 불러오지 못했어요. 아래에서 퀴즈를 탐색할 수 있어요.":"Insights are unavailable; browse questions below."}</p>}
  {!loading&&!error&&!present.length&&<p className="muted">
    {ko?"아직 추천 가능한 콘텐츠가 충분하지 않아요. 아래에서 퀴즈를 찾아보세요.":"Not enough eligible content yet. Try the quiz browser below."}
  </p>}
  {present.map(section=><div className={"discover-ranked-section"+(section.key==="surprise"?" discover-surprise-section":"")} key={section.key}>
    <div className="discover-results-head">
      <h3>{names[section.key].icon} {ko?names[section.key].ko:names[section.key].en}</h3>
      <span className="muted">{section.key==="surprise"
        ?(ko?"공개된 콘텐츠를 다양하게 섞었어요 · 인기 순위 아님":"A rotating mix · not a popularity ranking")
        :section.key==="difficult"?(ko?"충분한 완료 기록을 바탕으로":"Based on completed attempts")
        :section.key==="highly_rated"?(ko?"최소 5개 평가":"At least five ratings")
        :section.key==="trending"?(ko?"최근 7일 변화":"Recent seven-day growth")
        :section.key==="popular"?(ko?"최근 30일":"Recent 30 days")
        :(ko?"신규 공개 콘텐츠":"Recently created published content")}</span>
    </div>
    <div className="discover-grid">{section.items.map(item=><article className="feature-card discover-card" key={item.type+item.id}>
      <div className="discover-card-top">
        <div className="pack-type-badges">
          <span className="small-tag">{item.type==="PACK"?(ko?"퀴즈팩":"Quiz pack"):(ko?"개별 문제":"Question")}</span>
          {item.type==="PACK"&&<KidsPackBadge eligible={item.kidsEligible} locale={locale}/>}
        </div>
        {item.type==="PACK"&&<span className="muted">{item.questionCount}{ko?"문제":" questions"}</span>}
      </div>
      <h4>{item.title}</h4>
      {item.type==="PACK"&&item.subtitle&&<p className="discover-card-description">{item.subtitle}</p>}
      <p className="muted">{ko?"제작자":"By"}: {item.creator}</p>
      {item.ratings.positivePercent!==null&&item.ratings.total>=5&&<p>👍 {item.ratings.positivePercent}% · {item.ratings.total}{ko?"명 평가":" ratings"}</p>}
      {section.key==="difficult"&&item.difficultyPercent!==null&&<p>🔥 {ko?"오답률":"Incorrect rate"} {item.difficultyPercent}%</p>}
      {section.key==="popular"&&<p>{item.started}{ko?"명 플레이":" distinct players"}</p>}
      {item.type==="PACK"&&<p className="muted">{item.orderMode==="RANDOM"?(ko?"랜덤 순서":"Random order"):(ko?"등록 순서":"Creator order")}</p>}
      <Link className="btn btn-outline discover-play-link"
        href={localizeHref(item.type==="PACK"?"/packs/"+item.id:"/play/"+item.id,locale)}>
        {item.type==="PACK"?(ko?"퀴즈팩 보기 →":"View pack →"):(ko?"문제 풀기 →":"Play →")}
      </Link>
    </article>)}</div>
  </div>)}
 </section>;
}
