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
function RankTable({ kind, items, hasPrevious, tr, locale }: {
  kind: "packs" | "questions"; items: RankRow[]; hasPrevious: boolean;
  tr: (en: string, ko: string) => string; locale: "ko" | "en";
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
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Starts", "시작")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Finished", "완료")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Completion", "완료율")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Accuracy", "정답률")}</th>
          <th style={{ padding: 12, textAlign: "right" }}>{tr("Growth", "증감률")}</th>
        </tr></thead>
        <tbody>{items.map((item, index) =>
          <tr key={item.id} style={{ borderBottom: "1px solid var(--line, #e7e7e7)" }}>
            <td style={{ padding: 12 }}>{index + 1}</td>
            <td style={{ padding: 12 }}>
              <Link href={localizeHref(kind === "packs" ? "/packs/" + item.id : "/admin/quiz-review/" + item.id, locale)}>
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

  const filters = resolveAnalyticsFilters(await searchParams);
  const data = await loadAdminContentAnalytics(filters);
  const url = localizeHref("/admin/analytics", locale);
  const series = data.trend;
  const max = Math.max(1, ...series.map(v => v.plays));
  const tiles = [
    { label: tr("Play starts", "플레이 시작"), value: count(data.totals.plays), change: diff(data.totals.playsChange) },
    { label: tr("Identified players", "식별된 플레이어"), value: count(data.totals.identifiedPlayers), change: null },
    { label: tr("Run completion", "플레이 완료율"), value: percent(data.totals.completionRate),
      change: pp(data.totals.completionRate, data.totals.previousCompletionRate) },
    { label: tr("Question exposures", "문제 노출"), value: count(data.totals.exposures), change: null },
    { label: tr("Answers submitted", "문제 응답"), value: count(data.totals.answered),
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
      <div className="review-section-heading"><h2>{tr("Play starts over time", "기간별 플레이 시작 추이")}</h2></div>
      {series.length ? <div role="img" aria-label={tr("Play starts per time bucket", "기간별 플레이 시작 건수")}
        style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 192, overflowX: "auto", padding: "12px 4px 0" }}>
        {series.map((item, index) =>
          <div key={item.day} title={item.day + ": " + count(item.plays)} style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center",
            flex: "1 0 10px", height: "100%", minWidth: series.length < 12 ? 25 : 10,
          }}>
            <div style={{ width: "100%", maxWidth: 38, minHeight: 2, borderRadius: "5px 5px 0 0",
              height: Math.max(2, item.plays / max * 156), background: "var(--accent, #3b82f6)" }}/>
            <small style={{ fontSize: 10, whiteSpace: "nowrap", height: 17 }}>
              {index % Math.max(1, Math.ceil(series.length / 7)) === 0 ? item.day.slice(5) : ""}
            </small>
          </div>)}
      </div> : <p className="muted">{tr("No play starts in this period.", "이 기간에 시작된 플레이가 없습니다.")}</p>}
    </section>
    <RankTable kind="packs" items={data.packs} hasPrevious={!!filters.previousStart} tr={tr} locale={locale}/>
    <RankTable kind="questions" items={data.questions} hasPrevious={!!filters.previousStart} tr={tr} locale={locale}/>
    <p className="muted" style={{ marginTop: 24, fontSize: 12 }}>
      {tr("Each new run counts once; resuming does not add a start. Question exposures count sessions opened, and accuracy excludes unfinished answers. Completion is measured for runs started in the period, including those completed later. Unique players include only identifiable accounts/child profiles (anonymous plays cannot be deduplicated). Ranking rates require at least five plays/answers; growth is unavailable when there is no prior baseline.",
        "플레이는 새로 생성된 실행 기록마다 1회이며 이어하기는 중복 집계되지 않습니다. 문제 노출은 실제 시작된 문제 세션 기준이고 정답률은 미완료 풀이를 제외합니다. 완료율은 선택 기간에 시작된 플레이가 현재까지 완료됐는지 기준입니다. 고유 플레이어는 식별 가능한 계정·아동 프로필만 포함하며 비회원은 중복 식별할 수 없습니다. 비율 정렬은 최소 5회 이상의 기록을 대상으로 하며 직전 기록이 0이면 증가율을 계산하지 않습니다.")}
    </p>
  </main>;
}
