import Link from "next/link";
import {headers} from "next/headers";
import {notFound,redirect} from "next/navigation";
import ManagementHeader from "../../../src/components/management-header";
import {actorFor} from "../../../src/modules/platform/auth";
import {adminGrowthReport} from "../../../src/modules/platform/growth-funnel";
import {resolveLocale,localizeHref} from "../../../src/i18n/core";
export const dynamic="force-dynamic";
const STEPS=[
  ["landing","Landing visits","홈 방문"],["teaser_click","Teaser clicks","퀴즈 클릭"],
  ["quick_start","Quick starts","5문제 시작"],["single_start","Single starts","개별 문제 시작"],
  ["pack_start","Pack starts","퀴즈팩 시작"],["first_answer","First answers","첫 답안 제출"],
  ["finish","Completions","완료"],["share","Shares","공유"]
] as const;
type Report={startDay:string;endDay:string;totals:Record<string,number>;
  daily:{day:string;counts:Record<string,number>}[];channels:{channel:string;counts:Record<string,number>}[]};
export default async function GrowthPage({searchParams}:{searchParams:Promise<{days?:string}>}){
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale")),ko=locale==="ko";
  const href=(path:string)=>localizeHref(path,locale);
  const actor=await actorFor(new Request("http://localhost/admin/growth",{headers:h}));
  if(!actor)redirect(href("/sign-in?callbackURL=%2Fadmin%2Fgrowth"));
  if(actor.role!=="ADMIN")notFound();
  const query=await searchParams,days=query.days==="30"?30:7,report=await adminGrowthReport({days},actor) as Report;
  const n=(x:number)=>new Intl.NumberFormat(ko?"ko-KR":"en-NZ").format(x);
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · CONVERSION" title={ko?"방문자 전환 분석":"Visitor conversion"}
      description={ko?"방문부터 첫 답안, 완료, 공유까지 개인정보 없이 집계합니다.":"Anonymous first-visit funnel events: landing, answers, completion and sharing."}/>
    <div className="actions">
      <Link href={href("/admin")} className="card-link">{ko?"← 관리자 홈":"← Admin home"}</Link>
      <Link href={href("/admin/growth?days=7")} className="btn btn-outline">7 {ko?"일":"days"}</Link>
      <Link href={href("/admin/growth?days=30")} className="btn btn-outline">30 {ko?"일":"days"}</Link>
      <Link href={href("/admin/analytics")} className="btn btn-outline">{ko?"실제 플레이 통계":"Verified play data"}</Link>
    </div>
    <p className="muted">{report.startDay} – {report.endDay} UTC</p>
    <div className="cards">{STEPS.map(([key,en,kr])=><article className="feature-card" key={key}>
      <p className="small-tag">{ko?kr:en}</p><h2>{n(report.totals[key]||0)}</h2></article>)}</div>
    <section className="section"><h2>{ko?"출처별 현황":"By entry source"}</h2>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}>
        <thead><tr><th>{ko?"출처":"Source"}</th>{STEPS.map(([key,en,kr])=><th key={key}>{ko?kr:en}</th>)}</tr></thead>
        <tbody>{report.channels.map(row=><tr key={row.channel}><th>{row.channel}</th>
          {STEPS.map(([key])=><td key={key}>{n(row.counts[key]||0)}</td>)}</tr>)}</tbody></table></div>
      {!report.channels.length&&<p>{ko?"아직 수집된 이벤트가 없어요.":"No events collected yet."}</p>}
    </section>
    <section className="section"><h2>{ko?"일별 현황":"By day"}</h2>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}>
        <thead><tr><th>UTC</th>{STEPS.map(([key,en,kr])=><th key={key}>{ko?kr:en}</th>)}</tr></thead>
        <tbody>{report.daily.map(row=><tr key={row.day}><th>{row.day}</th>
          {STEPS.map(([key])=><td key={key}>{n(row.counts[key]||0)}</td>)}</tr>)}</tbody></table></div>
    </section>
    <p className="muted">{ko?"브라우저 탭 단위로 중복 제거한 비검증 신호입니다. 고유 사용자나 실제 플레이 완료율로 해석하면 안 돼요. 어린이 게임은 제외합니다.":"Unverified tab-deduplicated signals, not unique visitors or verified completion rates. Kids are excluded."}</p>
  </main>;
}
