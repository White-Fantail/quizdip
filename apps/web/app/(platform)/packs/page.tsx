import Link from "next/link";
import {Fragment} from "react";
import AdSlot from "../../../src/components/ads/AdSlot";
import KidsPackBadge from "../../../src/components/kids-pack-badge";
import { splitPackDescription } from "../../../src/modules/quiz/pack-description";
import { headers } from "next/headers";
import { resolveLocale,localizeHref } from "../../../src/i18n/core";
import { packList } from "../../../src/modules/platform/social";
import { INDEX_ORIGIN, canonicalUrl } from "../../../src/lib/search-indexing";
import type { Metadata } from "next";

export async function generateMetadata({searchParams}:{searchParams:Promise<{page?:string}>}):Promise<Metadata>{
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const page=Math.min(100,Math.max(0,Number.parseInt((await searchParams).page||"0",10)||0));
  const title=locale==="ko"?"퀴즈팩 탐색 · QuizDip":"Browse quiz packs · QuizDip";
  const description=locale==="ko"
    ?"제작자의 소개와 공개된 퀴즈팩을 둘러보고, 실제 문제를 미리 살펴본 뒤 도전해 보세요."
    :"Browse published quiz collections, creator descriptions and previews of real questions before you play.";
  const url=canonicalUrl(localizeHref("/packs",locale)+(page?"?page="+page:""));
  return {title,description,metadataBase:new URL(INDEX_ORIGIN),
    alternates:{canonical:url,...(page===0?{languages:{
      en:canonicalUrl("/en/packs"),ko:canonicalUrl("/ko/packs")
    }}:{})},
    openGraph:{title,description,url,siteName:"QuizDip",type:"website"}};
}
export const dynamic="force-dynamic";
export default async function PackCatalog({searchParams}:{searchParams:Promise<{page?:string}>}){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const params=await searchParams;
  const page=Math.min(100,Math.max(0,Number.parseInt(params.page||"0",10)||0));
  const {items}=await packList({mine:false,locale,limit:20,offset:page*20},null);
  return <main className="container inner-page management-page">
    <div className="play-intro"><span className="eyebrow">QUIZDIP · DISCOVER</span>
      <h1>{locale==="ko"?"퀴즈팩 탐색":"Explore quiz packs"}</h1>
      <p className="lead">{locale==="ko"?"제작자가 직접 구성한 문제를 순서대로 플레이하세요.":"Play complete question collections created by the community."}</p>
    </div>
    {!items.length&&<p>{locale==="ko"?"현재 이 언어로 플레이할 수 있는 퀴즈팩이 없어요.":"No playable quiz packs in this language yet."}</p>}
    <div className="cards">{items.map((pack,index)=><Fragment key={pack.id}>
      {index===8&&<AdSlot placement="PACK_LIST" fullRow/>}
      <article className="feature-card">
      <div className="pack-type-badges">
        <span className="small-tag">{locale==="ko"?"퀴즈팩":"Quiz pack"}</span>
        <KidsPackBadge eligible={pack.kidsEligible} locale={locale}/>
      </div>
      <h2>{pack.title}</h2><p>{splitPackDescription(pack.description||"").intro}</p>
      <p className="muted">{pack.quizIds.length} {locale==="ko"?"문제":"questions"} · {pack.orderMode==="RANDOM"?(locale==="ko"?"랜덤 순서":"Random order"):(locale==="ko"?"등록 순서":"Creator order")}</p>
      <div className="actions">
        <Link className="btn btn-primary" href={localizeHref("/packs/"+pack.id+"/play?src=discover",locale)}>{locale==="ko"?"바로 시작 →":"Play now →"}</Link>
        <Link className="btn btn-outline" href={localizeHref("/packs/"+pack.id+(page?"?page="+page:""),locale)}>{locale==="ko"?"팩 소개":"Details"}</Link>
      </div>
    </article></Fragment>)}</div>
    <nav className="media-pagination">
      {page>0&&<Link className="btn btn-outline" href={localizeHref("/packs?page="+(page-1),locale)}>{locale==="ko"?"이전":"Previous"}</Link>}
      {items.length===20&&<Link className="btn btn-outline" href={localizeHref("/packs?page="+(page+1),locale)}>{locale==="ko"?"다음":"Next"}</Link>}
    </nav>
  </main>;
}
