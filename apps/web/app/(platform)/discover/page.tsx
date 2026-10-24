"use client";

import Link from "next/link";
import { useLocale, useTranslation } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";
import { bilingual } from "../../../src/i18n/view-copy";
import { RatingBadge } from "../../../src/components/quiz-ratings";
import {Fragment,useEffect,useState} from "react";
import AdSlot from "../../../src/components/ads/AdSlot";
import {listPageIndex,useListUrlState} from "../../../src/lib/list-url-state";
import DiscoverySections from "./discovery-sections";
import EditorialHighlights from "./editorial-highlights";
import PackBrowser from "./pack-browser";
import PackSpotlight from "./pack-spotlight";
import {
  ANSWER_TYPES, audienceAgeLabel, difficultyLabel, discoverQuery, modeLabel,
  publicTopics, type DiscoverQuiz
} from "../../../src/modules/quiz/discover-metadata";

const PAGE_SIZE = 12;
type Topic = { id: string; name: string; key: string };

async function getData(path: string,locale:"en"|"ko"="en"): Promise<any> {
  const response = await fetch("/api/v1" + path, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || bilingual(locale,"Could not load quizzes.","퀴즈를 불러오지 못했어요."));
  return body.data;
}

export default function DiscoverPage() {
  const locale = useLocale();
  const t = useTranslation();
  const typeLabelsEn: Record<string, string> = { animal:"Animal", person:"Person", place:"Place", thing:"Thing", event:"Event", concept:"Concept", other:"Other" };
  const [listing,updateListing,ready]=useListUrlState({
    view:"ALL",answerType:"",topic:"",kids:"false",page:"1",packPage:"1"
  });
  const contentView=(["ALL","PACK","QUIZ"].includes(listing.view)?listing.view:"ALL") as "ALL"|"PACK"|"QUIZ";
  const answerType=listing.answerType,topic=listing.topic,kids=listing.kids==="true";
  const page=listPageIndex(listing.page);
  const setPage=(value:number)=>updateListing({page:String(value+1)});
  const [rotation, setRotation] = useState(0);
  const [spotlightIds, setSpotlightIds] = useState<string[]>([]);
  const [editorialIds, setEditorialIds] = useState<string[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizzes, setQuizzes] = useState<DiscoverQuiz[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setTopics([]);
    void getData("/topics?limit=100" + "&locale=" + locale + (kids ? "&kids=true" : ""),locale).then(data => {
      if (active) setTopics(data.items ?? []);
    }).catch(() => {
      // Quiz listings still work if the optional topic suggestions fail.
    });
    return () => { active = false; };
  }, [kids,locale]);

  useEffect(() => {
    if(!ready)return;
    let active = true;
    setLoading(true);
    setError("");
    const query = discoverQuery({ answerType, topic, kids, locale, offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 });
    void getData("/quizzes?" + query,locale).then(data => {
      if (!active) return;
      const all = (data.items ?? []) as DiscoverQuiz[];
      setQuizzes(all.slice(0, PAGE_SIZE));
      setHasMore(all.length > PAGE_SIZE);
    }).catch(e => {
      if (!active) return;
      setQuizzes([]);
      setHasMore(false);
      setError(e instanceof Error ? e.message : "퀴즈를 불러오지 못했어요.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready,answerType, topic, kids, page, retry, locale]);

  function changeType(value: string) { updateListing({answerType:value,page:"1"}); }
  function changeTopic(value: string) { updateListing({topic:value,page:"1"}); }
  function changeKids(value: boolean) { updateListing({kids:String(value),topic:"",page:"1"}); }
  function clearFilters(){updateListing({answerType:"",topic:"",kids:"false",page:"1"});}
  const activeFilters = Boolean(answerType || topic || kids);

  return (
    <main className="container inner-page discover-page">
      <span className="eyebrow">QUIZDIP DISCOVER</span>
      <h1>{t("discover.heading")}</h1>
      <p className="lead">{t("discover.lead")}</p>
      {!kids&&<div className="discover-explore-prompt">
        <div>
          <span className="discover-explore-kicker">{locale==="ko"?"✨ 오늘은 뭘 맞혀볼까?":"✨ WHAT WILL YOU SOLVE?"}</span>
          <strong>{locale==="ko"?"새로운 호기심을 하나 골라보세요.":"Your next little adventure starts here."}</strong>
          <p>{locale==="ko"?"짧게 한 판, 좋아하는 주제로 길게, 아니면 뜻밖의 발견까지.":"A quick round, a deep dive into a topic, or a surprise discovery."}</p>
        </div>
        <div className="discover-explore-actions">
          <Link className="btn btn-primary" href={localizeHref("/play",locale)}>
            🎲 {locale==="ko"?"바로 플레이":"Quick play"}
          </Link>
          <button type="button" className="btn btn-outline" onClick={()=>updateListing({view:"PACK",packPage:"1"})}>
            📚 {locale==="ko"?"시리즈 탐색":"Explore series"}
          </button>
        </div>
      </div>}
      {!kids && contentView === "ALL" && <PackSpotlight rotation={rotation} onSelected={setSpotlightIds} onBrowsePacks={() => updateListing({view:"PACK",packPage:"1"})} />}

      <div id="discover-content" className="actions discover-view-switch" role="group" aria-label={locale==="ko"?"탐색 콘텐츠 유형":"Discover content type"}>
        {(["ALL","PACK","QUIZ"] as const).map(view=><button key={view} type="button"
          className={"btn "+(contentView===view?"btn-primary":"btn-outline")} aria-pressed={contentView===view}
          onClick={()=>updateListing({view})}>
          {view==="ALL"?(locale==="ko"?"전체":"All"):view==="PACK"?(locale==="ko"?"퀴즈팩":"Quiz packs"):(locale==="ko"?"개별 문제":"Questions")}
        </button>)}
      </div>
      {contentView==="ALL"&&!kids&&<><EditorialHighlights onSelected={setEditorialIds}/><DiscoverySections rotation={rotation} onRemix={()=>setRotation(value=>(value+1)%1001)} excludedIds={[...spotlightIds,...editorialIds]}/><AdSlot placement="DISCOVER_FEED"/></>}
      {contentView==="PACK"&&<PackBrowser kids={kids} page={listPageIndex(listing.packPage)}
        onPageChange={next=>updateListing({packPage:String(next+1)})} ready={ready}/>}
      {contentView!=="PACK"&&<>
      <section className="discover-filters" aria-label={t("discover.filters")}>
        <label>
          <span>{t("discover.answerType")}</span>
          <select value={answerType} onChange={e => changeType(e.target.value)}>
            <option value="">{t("discover.allTypes")}</option>
            {ANSWER_TYPES.map(type =>
              <option value={type.value} key={type.value}>{locale === "en" ? typeLabelsEn[type.value] : type.label}</option>
            )}
          </select>
        </label>
        <label>
          <span>{t("discover.topic")}</span>
          <select value={topic} onChange={e => changeTopic(e.target.value)}>
            <option value="">{t("discover.allTopics")}</option>
            {topic && !topics.some(item => item.name === topic) &&
              <option value={topic}>{topic}</option>}
            {topics.map(item => <option value={item.key} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="discover-kids-option">
          <input type="checkbox" checked={kids} onChange={e => changeKids(e.target.checked)} />
          <span>{t("discover.kidsOnly")}</span>
        </label>
        {activeFilters &&
          <button className="text-button" type="button" onClick={() => {
            clearFilters();
          }}>{t("discover.clearFilters")}</button>}
      </section>

      <div className="discover-results-head">
        <h2>{t("discover.browse")}</h2>
        <span className="muted">{loading ? t("discover.loading") : quizzes.length ? t("discover.ready") : t("discover.none")}</span>
      </div>
      {error && <div className="feedback" role="alert">
        {error} <button type="button" className="text-button" onClick={() => setRetry(v => v + 1)}>{t("discover.retry")}</button>
      </div>}
      {!loading && !error && !quizzes.length &&
        <div className="discover-empty">
          <h3>{t("discover.empty")}</h3>
          <p className="muted">{kids
            ? t("discover.emptyKids")
            : t("discover.emptyGeneral")}</p>
          {activeFilters && <button className="btn btn-outline" onClick={() => {
            clearFilters();
          }}>{t("discover.viewAll")}</button>}
        </div>}
      {loading && <p className="muted" role="status">{t("discover.searching")}</p>}
      {!loading && !error && !!quizzes.length && <div className="discover-grid">
        {quizzes.map((quiz,index) => {
          const kind = ANSWER_TYPES.find(type => type.value === quiz.answerType);
          const age = audienceAgeLabel(quiz.recommendedAudience, locale);
          const difficulty = difficultyLabel(quiz.recommendedAudience, locale);
          return <Fragment key={quiz.id}>
            {index===6&&<AdSlot placement="DISCOVER_FEED" kids={kids} fullRow/>}
            <article className="feature-card discover-card">
            <div className="discover-card-top">
              <span className="symbol mint" aria-hidden="true">{kind?.icon ?? "✨"}</span>
              <span className="small-tag">{locale === "en" ? (typeLabelsEn[quiz.answerType] || "Quiz") : (kind?.label ?? "퀴즈")}</span>
            </div>
            <h3>{quiz.title}</h3>
            <p className="discover-card-description">{quiz.prompt}</p>
            <div className="discover-tags">
              {publicTopics(quiz).slice(0, 5).map(item =>
                <button type="button" key={item.id ?? item.key ?? item.name}
                  className="discover-topic" onClick={() => changeTopic(item.key ?? item.name)}>
                  # {item.name}
                </button>
              )}
            </div>
            <RatingBadge ratings={quiz.ratings}/>
            <div className="discover-card-meta">
              <span>{modeLabel(quiz.mode, locale)}</span>
              <span>{t("discover.clues")}: {quiz.clueCount}</span>
              {age && <span>{age}</span>}
              {difficulty && <span>{t("discover.difficulty")}: {difficulty}</span>}
              {quiz.kidsEligible && <span>{t("discover.approved")}</span>}
            </div>
            <Link href={localizeHref("/play/" + quiz.id + (kids ? "?kids=true" : ""), locale)}
              className="btn btn-primary discover-play-link">{t("discover.play")}</Link>
            </article>
          </Fragment>;
        })}
      </div>}
      {!loading && !error && (page > 0 || hasMore) &&
        <nav className="discover-pagination" aria-label={t("discover.pagination")}>
          <button type="button" className="btn btn-outline" disabled={page === 0}
            onClick={() => setPage(Math.max(0, page - 1))}>{t("discover.previous")}</button>
          <span>{page + 1} {t("discover.page")}</span>
          <button type="button" className="btn btn-outline" disabled={!hasMore}
            onClick={() => setPage(page + 1)}>{t("discover.next")}</button>
        </nav>}
      <p className="muted discover-explainer">{t("discover.explainer")}</p>
      </>}
    </main>
  );
}
