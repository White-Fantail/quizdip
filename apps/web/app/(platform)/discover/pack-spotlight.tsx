"use client";

import Link from "next/link";
import KidsPackBadge from "../../../src/components/kids-pack-badge";
import { useEffect, useState } from "react";
import { useLocale } from "../../../src/i18n/provider";
import { loadDiscoverySections } from "./discovery-client";
import { localizeHref } from "../../../src/i18n/core";

type PackCard = {
  id: string;
  type?: "QUIZ" | "PACK";
  title: string;
  subtitle: string;
  creator: string;
  questionCount: number;
  orderMode?: string;
  kidsEligible?: boolean;
  started: number;
  ratings: { total: number; positivePercent: number | null };
};
type PackRow = { pack: PackCard; popular: boolean };
type DiscoverySection = { key: string; items: PackCard[] };
type CatalogPack = {
  id: string; title: string; description: string; quizIds: string[]; orderMode: string; kidsEligible?: boolean;
  ratings?: { total: number; positivePercent: number | null } | null;
};

async function readData(path: string): Promise<any> {
  const response = await fetch("/api/v1" + path, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || body.error || "Could not load quiz packs");
  return body.data;
}

export default function PackSpotlight({ onBrowsePacks, rotation, onSelected }: { onBrowsePacks: () => void; rotation:number; onSelected:(keys:string[])=>void }) {
  const locale = useLocale(), ko = locale === "ko";
  const [items, setItems] = useState<PackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setItems([]);
    onSelected([]);
    setLoading(true);
    setFailed(false);
    // The ranking API applies publication, locale, moderation and media gates.
    // The public pack list is a separately gated fallback for sparse/new catalogs.
    void Promise.allSettled([
      loadDiscoverySections(locale,rotation),
      readData("/packs?locale=" + locale + "&limit=8&offset=0")
    ]).then(([discovery, catalog]) => {
      if (!live) return;
      if (discovery.status === "rejected" && catalog.status === "rejected") {
        setFailed(true);
        return;
      }
      const sections: DiscoverySection[] =
        discovery.status === "fulfilled" ? (discovery.value.sections ?? []) : [];
      const packSection = (key: string) =>
        sections.find(section => section.key === key)?.items.filter(item => item.type === "PACK") ?? [];
      const popular = packSection("popular_packs");
      const newlyDiscovered = packSection("new_packs");
      const surprise = packSection("surprise");
      const catalogRows: PackCard[] = catalog.status === "fulfilled"
        ? ((catalog.value.items ?? []) as CatalogPack[]).map(pack => ({
          id: pack.id, title: pack.title, subtitle: pack.description, creator: "",
          questionCount: pack.quizIds.length, orderMode: pack.orderMode, kidsEligible: pack.kidsEligible, started: 0,
          ratings: pack.ratings ?? { total: 0, positivePercent: null }
        }))
        : [];
      const unique = new Set<string>();
      const selected: PackRow[] = [];
      // One genuinely popular pick, one newer pick, then a rotating discovery.
      // The former implementation always filled all three slots from "popular".
      const today = Math.floor(Date.now() / 86400000);
      const rotate = (rows:PackCard[]) => rows.length
        ? [...rows.slice((today+rotation)%rows.length),...rows.slice(0,(today+rotation)%rows.length)] : rows;
      const groups = [[rotate(popular), true], [rotate(newlyDiscovered), false],
        [surprise, false], [catalogRows, false]] as const;
      for (const [group, isPopular] of groups) {
        const pack=group.find(item=>!unique.has(item.id));
        if(!pack)continue;
        unique.add(pack.id);
        selected.push({pack,popular:isPopular});
        if(selected.length===3)break;
      }
      // Sparse data can have fewer than three distinct groups.
      if(selected.length<3)for(const [group,isPopular] of groups){
        for(const pack of group){
          if(unique.has(pack.id))continue;
          unique.add(pack.id);selected.push({pack,popular:isPopular});
          if(selected.length===3)break;
        }
        if(selected.length===3)break;
      }
      onSelected(selected.map(item=>"PACK:"+item.pack.id));
      setItems(selected);
    }).catch(() => { if (live) setFailed(true); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [locale,rotation,onSelected]);

  return <section className="discover-pack-spotlight" aria-label={ko ? "추천 퀴즈팩" : "Featured quiz packs"}>
    <div className="discover-pack-heading">
      <div>
        <span className="eyebrow">{ko ? "먼저 즐겨보세요" : "START EXPLORING"}</span>
        <h2>{ko ? "오늘 만나볼 퀴즈팩" : "Packs to try today"}</h2>
        <p className="muted">{ko
          ? "인기작과 새로운 이야기, 뜻밖의 발견을 섞었어요. 인기 표시는 실제 플레이 기록을 기준으로 해요."
          : "A mix of popular, fresh and unexpected packs. Popular labels are backed by real plays."}</p>
      </div>
      <button type="button" className="discover-pack-more" onClick={onBrowsePacks}>
        {ko ? "모든 퀴즈팩 보기" : "Browse all packs"} <span aria-hidden="true">→</span>
      </button>
    </div>
    {loading && <div className="discover-pack-grid" aria-live="polite">
      {[0, 1, 2].map(index => <div key={index} className="discover-pack-loading" aria-hidden="true" />)}
      <span className="sr-only">{ko ? "퀴즈팩 불러오는 중" : "Loading quiz packs"}</span>
    </div>}
    {!loading && failed && <p className="muted">{ko ? "퀴즈팩을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." : "Could not load quiz packs. Please try again shortly."}</p>}
    {!loading && !failed && !items.length && <div className="discover-pack-empty">
      <p>{ko ? "현재 이 언어로 플레이할 수 있는 공개 퀴즈팩이 없어요." : "No published quiz packs are playable in this language yet."}</p>
      <p className="muted">{ko ? "다른 언어의 퀴즈팩은 해당 언어의 Discover에서 볼 수 있어요." : "Packs published in another language appear in that language's Discover page."}</p>
    </div>}
    {!loading && !!items.length && <div className="discover-pack-grid">
      {items.map(({ pack, popular }, index) => <article className={"discover-pack-card" + (index === 0 ? " discover-pack-card-primary" : "")} key={pack.id}>
        <div className="discover-pack-card-top">
          <div className="pack-type-badges">
            <span className="discover-pack-kind">{popular ? (ko ? "인기 퀴즈팩" : "Popular pack") : (ko ? "추천 탐색" : "Explore this pack")}</span>
            <KidsPackBadge eligible={pack.kidsEligible} locale={locale}/>
          </div>
          <span className="discover-pack-number">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <Link className="discover-pack-title" href={localizeHref("/packs/" + pack.id, locale)}>{pack.title}</Link>
        <p className="discover-pack-description">{pack.subtitle || (ko ? "다양한 단서를 통해 정답을 찾아보세요." : "Follow the clues and discover the answers.")}</p>
        <div className="discover-pack-details">
          <span>{pack.questionCount} {ko ? "문제" : "questions"}</span>
          <span>{pack.orderMode === "RANDOM" ? (ko ? "랜덤 순서" : "Shuffled") : (ko ? "제작자 순서" : "In order")}</span>
          {popular && <span>{pack.started} {ko ? "명 플레이" : "players"}</span>}
          {pack.ratings?.positivePercent != null && pack.ratings.total >= 5 &&
            <span>👍 {pack.ratings.positivePercent}%</span>}
        </div>
        <Link className="btn btn-primary discover-pack-start" href={localizeHref("/packs/" + pack.id + "/play", locale)}>
          {ko ? "이 팩 시작하기" : "Play this pack"} <span aria-hidden="true">→</span>
        </Link>
      </article>)}
    </div>}
  </section>;
}
