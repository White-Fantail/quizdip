import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ManagementHeader from "../../../../../src/components/management-header";
import { localizeHref, resolveLocale } from "../../../../../src/i18n/core";
import { actorFor } from "../../../../../src/modules/platform/auth";
import { db } from "../../../../../src/modules/platform/db";
import { authPool } from "../../../../../src/lib/auth";
import { resolveAnalyticsFilters, type AnalyticsParams } from "../../../../../src/modules/platform/admin-content-analytics";

export const dynamic="force-dynamic";
type Query=AnalyticsParams & {revision?:string};
type Answer={responseMode?:string;options?:string[]};
export default async function AdminChoiceStatsPage({params,searchParams}:{
  params:Promise<{quizId:string}>;searchParams:Promise<Query>;
}) {
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const tr=(en:string,ko:string)=>locale==="ko"?ko:en;
  const actor=await actorFor(new Request("http://localhost/admin/analytics/questions",{headers:h}));
  if(!actor)redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fanalytics",locale));
  if(actor.role!=="ADMIN")notFound();
  const {quizId}=await params, query=await searchParams;
  const f=resolveAnalyticsFilters(query);
  const quiz=await db().quiz.findUnique({where:{id:quizId},
    select:{id:true,sourceLocale:true,revisions:{
      orderBy:{createdAt:"desc"},take:100,
      select:{id:true,title:true,createdAt:true,answer:true,
        localization:{select:{locale:true}}}
    }}});
  if(!quiz)notFound();
  const all=quiz.revisions.filter(row=>(row.answer as Answer)?.responseMode==="multiple-choice" &&
    Array.isArray((row.answer as Answer)?.options));
  const preferred=all.filter(row=>f.locale==="all" || row.localization?.locale===f.locale);
  const chosen=preferred.find(row=>row.id===query.revision)??preferred[0]??all[0];
  const link=localizeHref("/admin/analytics",locale);
  const rows: Array<{choice:string;plays:string}> = chosen
    ? (await authPool().query<{choice:string;plays:string}>(`
      SELECT s."firstChoice" AS choice, COUNT(*)::text AS plays
      FROM "PlaySession" s
      LEFT JOIN "PlayRun" r ON r."id"=s."runId"
      LEFT JOIN "KidPlayRun" kr ON kr."runId"=r."id"
      LEFT JOIN "KidPlaySingle" ks ON ks."sessionId"=s."id"
      WHERE s."quizId"=$1 AND s."revisionId"=$2
        AND s."startedAt" >= $3 AND s."startedAt" < $4
        AND s."firstChoice" IS NOT NULL
        AND ($5::text='all' OR s."locale"=$5)
        AND ($6::text='all' OR ($6::text='KIDS' AND (r."lane"='KIDS' OR kr."runId" IS NOT NULL OR ks."sessionId" IS NOT NULL))
          OR ($6::text='GENERAL' AND ks."sessionId" IS NULL AND kr."runId" IS NULL AND (r."lane"='GENERAL' OR r."id" IS NULL)))
        AND ($7::text='all' OR ($7::text='DISCOVER' AND s."runId" IS NULL) OR r."mode"=$7)
      GROUP BY s."firstChoice"`,
      [quizId,chosen.id,f.start,f.end,f.locale,f.audience,f.mode])).rows : [];
  const responseCount=rows.reduce((total,row)=>total+Number(row.plays),0);
  const counts=new Map(rows.map(row=>[row.choice,Number(row.plays)]));
  const choices=(chosen?.answer as Answer|undefined)?.options??[];
  const number=new Intl.NumberFormat(locale==="ko"?"ko-KR":"en-NZ");
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · ANALYTICS"
      title={tr("Answer choice distribution","보기별 선택 비율")}
      description={tr("First submitted choice per session, grouped by immutable question revision.",
        "각 플레이에서 처음 제출한 보기를 문제 버전별로 집계합니다.")}/>
    <div className="actions"><Link className="card-link" href={link}>← {tr("Content analytics","콘텐츠 분석")}</Link></div>
    <section className="section review-console" style={{marginTop:20}}>
      <h2 style={{marginTop:0}}>{chosen?.title??quiz.id}</h2>
      <form method="GET" action={localizeHref("/admin/analytics/questions/"+quizId,locale)}
        style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}>
        <label style={{display:"grid",gap:5}}>{tr("Question revision","문제 버전")}
          <select name="revision" defaultValue={chosen?.id??""} style={{maxWidth:340,padding:10}}>
            {all.map(row=><option key={row.id} value={row.id}>{row.title} · {row.localization?.locale??quiz.sourceLocale} · {row.createdAt.toISOString().slice(0,10)}</option>)}
          </select>
        </label>
        <label style={{display:"grid",gap:5}}>{tr("Period","기간")}
          <select name="period" defaultValue={f.period} style={{padding:10}}>
            {[["today",tr("Today","오늘")],["yesterday",tr("Yesterday","어제")],
              ["7",tr("7 days","7일")],["30",tr("30 days","30일")],["90",tr("90 days","90일")],
              ["all",tr("All time","전체")],["custom",tr("Custom","직접 선택")]]
              .map(([v,t])=><option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label style={{display:"grid",gap:5}}>{tr("Start","시작일")}
          <input name="start" type="date" defaultValue={f.startDay} style={{padding:10}}/>
        </label>
        <label style={{display:"grid",gap:5}}>{tr("End","종료일")}
          <input name="end" type="date" defaultValue={f.endDay} style={{padding:10}}/>
        </label>
        <label style={{display:"grid",gap:5}}>{tr("Language","언어")}
          <select name="locale" defaultValue={f.locale} style={{padding:10}}>
            <option value="all">{tr("All","전체")}</option><option value="ko">한국어</option><option value="en">English</option>
          </select>
        </label>
        <label style={{display:"grid",gap:5}}>{tr("Audience","대상")}
          <select name="audience" defaultValue={f.audience} style={{padding:10}}>
            <option value="all">{tr("All","전체")}</option><option value="GENERAL">{tr("General","일반")}</option><option value="KIDS">Kids</option>
          </select>
        </label>
        <label style={{display:"grid",gap:5}}>{tr("Mode","모드")}
          <select name="mode" defaultValue={f.mode} style={{padding:10}}>
            <option value="all">{tr("All","전체")}</option>
            <option value="PACK">Pack</option><option value="RANDOM_FIVE">Random 5</option>
            <option value="INFINITE">Infinite</option><option value="DISCOVER">Discover</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit">{tr("Apply","조회")}</button>
      </form>
      <p className="muted" style={{fontSize:13}}>{f.startDay} — {f.endDay}
        {" · "}{tr("Captured first choices","수집된 최초 선택")}: {number.format(responseCount)}</p>
      {!chosen && <p className="muted">{tr("This question has no authored multiple-choice revisions.",
        "이 문제에는 제작자가 만든 객관식 보기가 없습니다.")}</p>}
      {chosen&&choices.map(option=>{
        const count=counts.get(option)??0;
        const pct=responseCount?count/responseCount*100:0;
        return <div key={option} style={{margin:"22px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
            <strong>{option}</strong><span>{number.format(count)} ({pct.toFixed(1)}%)</span>
          </div>
          <div style={{height:10,marginTop:7,borderRadius:8,background:"var(--surface-secondary,#e9e9e9)",overflow:"hidden"}}>
            <div style={{height:"100%",width:pct+"%",background:"var(--accent,#3b82f6)"}}/>
          </div>
        </div>;
      })}
      {chosen && responseCount===0 && <p className="muted">{tr("No choices have been captured for this revision and period.",
        "해당 기간과 버전에서 아직 선택 보기가 수집되지 않았습니다.")}</p>}
      <p className="muted" style={{fontSize:12,marginTop:24}}>
        {tr("Only the first valid authored multiple-choice submission is counted per session. Historical attempts before this feature have no choice data. Kids automatically generated choices and text questions are excluded. Each revision is kept separate so updated options cannot distort older results.",
          "각 세션에서 최초 제출한 유효한 제작자 객관식 보기만 1회 집계합니다. 기능 적용 전 기록에는 보기 데이터가 없습니다. 자동 생성된 Kids 보기와 주관식은 제외합니다. 수정된 보기와 과거 보기가 섞이지 않도록 버전별로 집계합니다.")}
      </p>
    </section>
  </main>;
}
