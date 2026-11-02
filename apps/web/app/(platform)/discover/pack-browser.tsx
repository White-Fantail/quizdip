"use client";
import Link from "next/link";
import {Fragment,useEffect,useState} from "react";
import AdSlot from "../../../src/components/ads/AdSlot";
import KidsPackBadge from "../../../src/components/kids-pack-badge";
import { splitPackDescription } from "../../../src/modules/quiz/pack-description";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
type Pack={id:string;title:string;description:string;publication:string;
  orderMode:"CREATOR"|"RANDOM";quizIds:string[];kidsEligible?:boolean;
  ratings?:{total:number;positivePercent:number|null}};
const SIZE=12;
export default function PackBrowser({page,onPageChange,ready,kids=false}:{page:number;onPageChange:(page:number)=>void;ready:boolean;kids?:boolean}){
  const locale=useLocale(),ko=locale==="ko";
  const [packs,setPacks]=useState<Pack[]>([]);
  const [hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{
    if(!ready)return;
    let active=true;setLoading(true);setError("");
    const query=new URLSearchParams({locale,limit:String(SIZE+1),offset:String(page*SIZE)});
    void fetch("/api/v1/packs?"+query,{cache:"no-store"}).then(async r=>{
      const body=await r.json();if(!r.ok)throw new Error(body.message||body.error||"Could not load packs");
      return body.data;
    }).then(v=>{if(!active)return;const rows=v.items??[];
      setPacks(rows.slice(0,SIZE));setHasMore(rows.length>SIZE);
    }).catch(e=>{if(active){setError(String(e));setPacks([])}})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[ready,page,locale]);
  return <section aria-label={ko?"퀴즈팩":"Quiz packs"}>
    <div className="discover-results-head">
      <h2>{ko?"퀴즈팩 둘러보기":"Browse quiz packs"}</h2>
      <p className="muted">{ko?"문제가 등록 순서 또는 랜덤 순서로 등장해요.":"Choose complete packs with creator or random ordering."}</p>
    </div>
    {loading&&<p role="status" className="muted">{ko?"불러오는 중…":"Loading…"}</p>}
    {error&&<p role="alert">{error}</p>}
    {!loading&&!error&&!packs.length&&<p className="muted">{ko?"지금 공개된 퀴즈팩이 없어요.":"No published quiz packs available yet."}</p>}
    <div className="discover-grid">{packs.map((pack,index)=><Fragment key={pack.id}>
      {index===6&&<AdSlot placement="DISCOVER_FEED" kids={kids} fullRow/>}
      <article className="feature-card discover-card">
      <div className="discover-card-top">
        <div className="pack-type-badges">
          <span className="small-tag">{ko?"퀴즈팩":"Quiz pack"}</span>
          <KidsPackBadge eligible={pack.kidsEligible} locale={locale}/>
        </div>
        <span className="muted">{pack.quizIds.length} {ko?"문제":"questions"}</span>
      </div>
      <h3>{pack.title}</h3><p className="discover-card-description">{splitPackDescription(pack.description||"").intro}</p>
      <p className="muted">{pack.orderMode==="RANDOM"?(ko?"랜덤 출제":"Random each play"):(ko?"제작자 순서":"Creator order")}</p>
      {pack.ratings?.positivePercent!==null&&pack.ratings?.positivePercent!==undefined&&
        <p>👍 {pack.ratings.positivePercent}% · {pack.ratings.total}{ko?"명 평가":" ratings"}</p>}
      <Link href={localizeHref("/packs/"+pack.id,locale)} className="btn btn-primary">
        {ko?"퀴즈팩 보기 →":"Explore pack →"}
      </Link>
    </article></Fragment>)}</div>
    <nav className="discover-pagination" aria-label={ko?"퀴즈팩 페이지":"Quiz pack pages"}>
      <button className="btn btn-outline" type="button" disabled={page===0||loading} onClick={()=>onPageChange(Math.max(0,page-1))}>
        {ko?"이전":"Previous"}</button>
      <span>{page+1}</span>
      <button className="btn btn-outline" type="button" disabled={!hasMore||loading} onClick={()=>onPageChange(page+1)}>
        {ko?"다음":"Next"}</button>
    </nav>
  </section>;
}
