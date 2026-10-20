import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ManagementHeader from "../../../src/components/management-header";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
import { actorFor } from "../../../src/modules/platform/auth";
import {
  loadAdminContentAnalytics, resolveAnalyticsFilters,
  type AnalyticsParams, type RankRow,
} from "../../../src/modules/platform/admin-content-analytics";
import { loadAdminContentInsights, resolveRisingKind, type RisingKind } from "../../../src/modules/platform/admin-content-insights";

export const dynamic = "force-dynamic";
const selectStyle = { minWidth: 128, maxWidth: "100%", padding: "9px 10px", borderRadius: 9 };
const fieldStyle = { display: "grid", gap: 5, fontSize: 13 } as const;
const numberFormat = new Intl.NumberFormat("en-NZ");
function count(value: number) { return numberFormat.format(value); }
function percent(value: number | null) { return value === null ? "—" : (value * 100).toFixed(1) + "%"; }
function diff(value: number | null) {
  if (value === null) return "—";
  return (value > 0 ? "+" : "") + (value * 100).toFixed(1) + "%";
}
function pp(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "—";
  const n = (current - previous) * 100;
  return (n > 0 ? "+" : "") + n.toFixed(1) + "pp";
}
function RankTable({ kind, items, hasPrevious, tr, locale, detailSuffix }: {
  kind: "packs" | "questions"; items: RankRow[]; hasPrevious: boolean;
  tr: (en: string, ko: string) => string; locale: "ko" | "en"; detailSuffix:string;
}) {
  return <section className="section review-console" style={{ marginTop: 24 }}>
    <div className="review-section-heading">
      <h2>{kind === "packs" ? tr("Most played packs", "인기 퀴즈팩 순위") : tr("Most played questions", "인기 개별 문제 순위")}</h2>
      <span className="small-tag">{items.length} {tr("items", "개")}</span>
    </div>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 680, fontSize: 14 }}>
        <thead><tr style={{ borderBottom: "1px solid var(--line, #dedede)" }}>
          <th style={{ padding: 12 }}>{tr("Rank", "순위")}</th>
          <th style={{ padding: 12 }}>{tr("Content", "콘텐츠")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{kind === "packs" ? tr("Played", "실제 참여") : tr("Attempted", "답안 시도")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Finished", "완료")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Completion", "완료율")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Accuracy", "정답률")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Growth", "증감률")}</th>
        </tr></thead>
        <tbody>{items.map((item, index) =>
          <tr key={item.id} style={{ borderBottom: "1px solid var(--line, #e7e7e7)" }}>
            <td style={{ padding: 12 }}>{index + 1}</td>
            <td style={{ padding: 12 }}>
              <Link href={localizeHref(kind === "packs" ? "/packs/" + item.id : "/admin/analytics/questions/" + item.id, locale) + (kind === "questions" ? detailSuffix : "")}>
                <strong>{item.title}</strong>
              </Link>
              {item.isKids && <small style={{ display: "inline-block", marginLeft: 8 }}>Kids</small>}
            </td>
            <td style={{ padding: 12, textAlign: "right" }}>{count(item.plays)}</td>
            <td style={{ padding: 12, textAlign: "right" }}>{count(item.completed)}</td>
            <td style={{ padding: 12, textAlign: "right" }}>{percent(item.completionRate)}</td>
            <td style={{ padding: 12, textAlign: "right" }}>{percent(item.accuracy)}</td>
            <td style={{ padding: 12, textAlign: "right" }}>{hasPrevious && item.previous === 0 && item.plays > 0
              ? tr("New", "신규") : diff(item.growth)}</td>
          </tr>,
        )}</tbody>
      </table>
      {!items.length && <p className="muted" style={{ padding: 20 }}>{tr("No play data for the selected filters.", "선택한 조건에 해당하는 플레이 기록이 없습니다.")}</p>}
    </div>
  </section>;
}
export default async function AdminContentAnalyticsPage({ searchParams }: {
  searchParams: Promise<AnalyticsParams>;
}) {
  const h = await headers();
  const locale = resolveLocale(h.get("x-quizdip-locale"));
  const tr = (en: string, ko: string) => locale === "ko" ? ko : en;
  const actor = await actorFor(new Request("http://localhost/admin/analytics", { headers: h }));
  if (!actor) redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fanalytics", locale));
  if (actor.role !== "ADMIN") notFound();

  const query = await searchParams;
  const filters = resolveAnalyticsFilters(query);
  const risingKind = resolveRisingKind(query.risingKind);
  const [data, insights] = await Promise.all([loadAdminContentAnalytics(filters), loadAdminContentInsights(filters, risingKind)]);
  const detailSuffix = "?" + new URLSearchParams({period:filters.period,start:filters.startDay,
    end:filters.endDay,locale:filters.locale,audience:filters.audience,mode:filters.mode}).toString();
  const url = localizeHref("/admin/analytics", locale);
  const risingQuery = (kind: RisingKind) => new URLSearchParams({
    period: filters.period, start: filters.startDay, end: filters.endDay,
    locale: filters.locale, audience: filters.audience, mode: filters.mode,
    creator: filters.creator, sort: filters.sort, risingKind: kind,
  }).toString();
  const series = data.trend;
  const max = Math.max(1, ...series.map(v => v.plays));
  const tiles = [
    { label: tr("Run records created", "실행 기록 생성"), value: count(data.totals.createdRuns), change: null },
    { label: tr("Runs with answers", "실제 참여"), value: count(data.totals.plays), change: diff(data.totals.playsChange) },
    { label: tr("No saved answers", "응답 없는 실행"), value: count(data.totals.createdRuns - data.totals.plays), change: null },
    { label: tr("Identified players", "식별된 플레이어"), value: count(data.totals.identifiedPlayers), change: null },
    { label: tr("Run completion", "플레이 완료율"), value: percent(data.totals.completionRate),
      change: pp(data.totals.completionRate, data.totals.previousCompletionRate) },
    { label: tr("Question exposures", "문제 노출"), value: count(data.totals.exposures), change: null },
    { label: tr("Graded questions", "채점 완료 문제"), value: count(data.totals.answered),
      change: diff(data.totals.answersChange) },
    { label: tr("Answer accuracy", "문제 정답률"), value: percent(data.totals.accuracy),
      change: pp(data.totals.accuracy, data.totals.previousAccuracy) },
  ];
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · ANALYTICS"
      title={tr("Content analytics", "콘텐츠 분석")}
      description={tr("Discover the most-played packs and questions, compare periods, and measure completion and accuracy.",
        "어떤 퀴즈팩과 문제가 인기 있는지 기간별 플레이·완료율·정답률로 확인합니다.")}/>
    <div className="actions"><Link href={localizeHref("/admin", locale)} className="card-link">← {tr("Admin home", "관리자 홈")}</Link></div>
    <section className="section review-console" style={{ marginTop: 20 }}>
      <form action={url} method="GET" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <input type="hidden" name="risingKind" value={risingKind}/>
        <label style={fieldStyle}>{tr("Period", "기간")}
          <select name="period" defaultValue={filters.period} style={selectStyle}>
            {[["today", tr("Today", "오늘")], ["yesterday", tr("Yesterday", "어제")],
              ["7", tr("Last 7 days", "최근 7일")], ["30", tr("Last 30 days", "최근 30일")],
              ["90", tr("Last 90 days", "최근 90일")], ["all", tr("All time", "전체 기간")],
              ["custom", tr("Custom dates", "직접 선택")]].map(([value, label]) =>
              <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>{tr("From (custom)", "시작일 (직접 선택)")}
          <input type="date" name="start" defaultValue={filters.startDay} style={selectStyle}/>
        </label>
        <label style={fieldStyle}>{tr("To (custom)", "종료일 (직접 선택)")}
          <input type="date" name="end" defaultValue={filters.endDay} style={selectStyle}/>
        </label>
        <label style={fieldStyle}>{tr("Language", "언어")}
          <select name="locale" defaultValue={filters.locale} style={selectStyle}>
            <option value="all">{tr("All", "전체")}</option><option value="ko">한국어</option><option value="en">English</option>
          </select>
        </label>
        <label style={fieldStyle}>{tr("Audience", "대상")}
          <select name="audience" defaultValue={filters.audience} style={selectStyle}>
            <option value="all">{tr("All", "전체")}</option>
            <option value="GENERAL">{tr("General", "일반")}</option>
            <option value="KIDS">Kids</option>
          </select>
        </label>
        <label style={fieldStyle}>{tr("Play mode", "플레이 모드")}
          <select name="mode" defaultValue={filters.mode} style={selectStyle}>
            <option value="all">{tr("All", "전체")}</option>
            <option value="PACK">{tr("Pack play", "퀴즈팩")}</option>
            <option value="RANDOM_FIVE">{tr("Random five", "랜덤 5문제")}</option>
            <option value="INFINITE">{tr("Infinite", "무한 랜덤")}</option>
            <option value="DISCOVER">Discover</option>
          </select>
        </label>
        <label style={fieldStyle}>{tr("Creator ID (optional)", "제작자 ID (선택)")}
          <input name="creator" defaultValue={filters.creator} maxLength={100} placeholder={tr("All creators", "전체 제작자")}
            style={{ ...selectStyle, width: 170 }}/>
        </label>
        <label style={fieldStyle}>{tr("Rank by", "정렬 기준")}
          <select name="sort" defaultValue={filters.sort} style={selectStyle}>
            <option value="plays">{tr("Most played", "플레이 많은 순")}</option>
            <option value="completion">{tr("Completion rate", "완료율 높은 순")}</option>
            <option value="accuracy">{tr("Answer accuracy", "정답률 높은 순")}</option>
            <option value="growth">{tr("Period growth", "기간 증가율 순")}</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">{tr("Apply filters", "조회")}</button>
      </form>
      <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
        {filters.startDay} — {filters.endDay} · {tr("Daily boundaries use Pacific/Auckland.", "날짜는 뉴질랜드 시간(Pacific/Auckland) 기준입니다.")}
        {" "}{filters.previousStart && tr("Changes compare the preceding period of equal length.", "증감은 동일 길이의 직전 기간과 비교합니다.")}
      </p>
    </section>
    <div className="cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12, marginTop: 20 }}>
      {tiles.map(tile => <article className="feature-card" key={tile.label} style={{ padding: 18, minWidth: 0 }}>
        <p style={{ fontSize: 13, margin: 0 }}>{tile.label}</p>
        <h2 style={{ fontSize: 26, margin: "8px 0" }}>{tile.value}</h2>
        {tile.change && <small>{tr("vs previous", "직전 기간 대비")}: {tile.change}</small>}
      </article>)}
    </div>
    <section className="section review-console" style={{ marginTop: 24 }}>
      <div className="review-section-heading"><h2>{tr("Actual plays over time", "기간별 실제 참여 추이")}</h2></div>
      {series.length ? <div role="img" aria-label={tr("Runs with saved answers per time bucket", "기간별 답안 시도가 저장된 실행 건수")}
        style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 192, overflowX: "auto", padding: "12px 4px 0" }}>
        {series.map((item, index) =>
          <div key={item.day} title={item.day + " · " + tr("Participated", "실제 참여") + ": " + count(item.plays) + " · " + tr("Created", "생성") + ": " + count(item.createdRuns)} style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center",
            flex: "1 0 10px", height: "100%", minWidth: series.length < 12 ? 25 : 10,
          }}>
            <div style={{ width: "100%", maxWidth: 38, minHeight: 2, borderRadius: "5px 5px 0 0",
              height: Math.max(2, item.plays / max * 156), background: "var(--accent, #3b82f6)" }}/>
            <small style={{ fontSize: 10, whiteSpace: "nowrap", height: 17 }}>
              {index % Math.max(1, Math.ceil(series.length / 7)) === 0 ? item.day.slice(5) : ""}
            </small>
          </div>)}
      </div> : <p className="muted">{tr("No runs with saved answers in this period.", "이 기간에 답안 시도가 저장된 플레이가 없습니다.")}</p>}
    </section>

    <section className="section review-console" style={{marginTop:24}}>
      <div className="review-section-heading">
        <h2>{tr("Rising content · Top 10","급상승 콘텐츠 TOP 10")}</h2>
        <span className="small-tag">{insights.trendPeriod==="7" && filters.period==="all"
          ? tr("Last 7 days","최근 7일") : tr("Selected period","선택 기간")}</span>
      </div>
      <p className="muted" style={{fontSize:13}}>
        {tr("Compared with the preceding equal-length period. At least 10 participating plays and eight additional plays are required; existing baselines also need at least five and 50% growth. Ranked by additional participating plays.",
          "직전 동일 기간과 비교합니다. 답안 시도가 저장된 실제 참여가 최소 10회, 순증 최소 8회 필요합니다. 기존 기록이 있다면 직전 5회 이상·성장률 50% 이상이어야 하며 실제 참여 증가량 순으로 정렬합니다.")}
      </p>
      <div role="group" aria-label={tr("Rising content type", "급상승 콘텐츠 유형")}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 16px" }}>
        {(["pack", "question"] as const).map(kind =>
          <Link key={kind} href={url + "?" + risingQuery(kind)}
            aria-current={risingKind === kind ? "page" : undefined}
            className={risingKind === kind ? "small-tag" : "card-link"}
            style={{ display: "inline-flex", alignItems: "center", padding: "7px 14px",
              border: "1px solid var(--line, #dedede)", borderRadius: 999, textDecoration: "none" }}>
            {kind === "pack" ? tr("Packs", "퀴즈팩") : tr("Questions", "개별 문제")}
          </Link>)}
      </div>
      <div className="review-result-list">
        {insights.rising.map((item,index)=><div key={item.kind+item.id} className="review-entry">
          <span className="review-entry-copy">
            <strong>{index+1}. <Link href={localizeHref(item.kind==="pack"?"/packs/"+item.id:"/admin/analytics/questions/"+item.id,locale)+
              (item.kind==="question"?detailSuffix:"")}>{item.title}</Link></strong>
            <small>{item.kind==="pack"?tr("Pack","퀴즈팩"):tr("Question","문제")} · {tr("Participated","실제 참여")} {count(item.plays)}
              {" · "}{tr("Previous","직전")} {count(item.previous)}
              {" · "}+{count(item.difference)} ({item.newActivity?tr("No previous plays","직전 기록 없음"):diff(item.growth)})</small>
          </span>
        </div>)}
        {!insights.rising.length&&<p className="muted">{tr("Nothing currently meets the rising-content thresholds.","현재 급상승 기준을 충족하는 콘텐츠가 없습니다.")}</p>}
      </div>
    </section>
    <section className="section review-console" style={{marginTop:24}}>
      <div className="review-section-heading">
        <h2>{tr("Content quality watchlist","개선이 필요한 콘텐츠")}</h2>
        <span className="small-tag">{insights.quality.length} {tr("signals","건")}</span>
      </div>
      <p className="muted" style={{fontSize:13}}>
        {tr("Read-only signals, not automatic moderation. Packs need 20 participating plays with under 50% completion; questions need 20 exposures with under 60% completion, or 20 graded answers with accuracy of 20% or less / 95% or more.",
          "품질 점검을 위한 참고 지표이며 자동 제재하지 않습니다. 팩은 최소 20회 실제 참여·완료율 50% 미만, 문제는 최소 20회 노출·완료율 60% 미만 또는 최소 20회 채점·정답률 20% 이하/95% 이상일 때 표시합니다.")}
      </p>
      <div className="review-result-list">
        {insights.quality.map((item,index)=>{
          const issue=item.issue==="low_completion"?tr("Low pack completion","낮은 팩 완료율")
            :item.issue==="dropoff"?tr("Question drop-off","문제 중도 이탈")
            :item.issue==="too_hard"?tr("Possibly too difficult","지나치게 어려울 수 있음")
            :tr("Possibly too easy","지나치게 쉬울 수 있음");
          return <div className="review-entry" key={item.kind+item.id+item.issue}>
            <span className="review-entry-copy">
              <strong>{index+1}. <Link href={localizeHref(item.kind==="pack"?"/packs/"+item.id:"/admin/analytics/questions/"+item.id,locale)+
                (item.kind==="question"?detailSuffix:"")}>{item.title}</Link></strong>
              <small>{issue} · {item.issue === "dropoff" ? tr("Exposures", "노출") : tr("Participated", "실제 참여")} {count(item.plays)}
                {" · "}{tr(item.issue==="too_easy"||item.issue==="too_hard"?"Accuracy":"Completion",
                item.issue==="too_easy"||item.issue==="too_hard"?"정답률":"완료율")} {percent(item.rate)}</small>
            </span>
          </div>;
        })}
        {!insights.quality.length&&<p className="muted">{tr("No content currently crosses these thresholds.","현재 품질 점검 기준에 해당하는 콘텐츠가 없습니다.")}</p>}
      </div>
    </section>
    <RankTable kind="packs" items={data.packs} hasPrevious={!!filters.previousStart} tr={tr} locale={locale} detailSuffix={detailSuffix}/>
    <RankTable kind="questions" items={data.questions} hasPrevious={!!filters.previousStart} tr={tr} locale={locale} detailSuffix={detailSuffix}/>
    <p className="muted" style={{ marginTop: 24, fontSize: 12 }}>
      {tr("Created runs count allocated run records, but actual participation requires at least one saved answer attempt (a graded answer or a server-recorded wrong guess). Offline pack answers count after syncing. Periods use the run's original start date, even when the answer arrives later. Question exposures count sessions opened, and accuracy excludes unfinished answers. Completion rates use participating runs only. Identified players exclude guest runs, which cannot be deduplicated. Ranking rates require at least five attempts; growth is unavailable without a prior baseline.",
        "생성 수는 실행 기록 기준, 실제 참여 수는 서버에 답안 시도가 최소 한 번 저장된 실행 기준입니다(채점 완료 또는 서버에 기록된 오답). 오프라인 팩 결과는 동기화 후 반영됩니다. 기간은 최초 실행 생성일 기준이며 나중에 답해도 생성일에 귀속됩니다. 문제 노출은 열린 세션 기준이고 정답률은 미채점 응답을 제외합니다. 완료율의 분모는 실제 참여한 실행이며 식별된 플레이어는 계정·아동 프로필만 포함합니다. 비회원 중복은 구별하지 못하고 비율 정렬에는 최소 5회의 시도가 필요합니다.")}
    </p>
  </main>;
}
