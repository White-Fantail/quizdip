import ManagementHeader from "../../src/components/management-header";
import { resolveLocale,localizeHref } from "../../src/i18n/core";
import { bilingual } from "../../src/i18n/view-copy";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { actorFor } from "../../src/modules/platform/auth";

export const dynamic = "force-dynamic";

/** Only authenticated platform administrators can access the backoffice. */
export default async function AdminPage() {
  const requestHeaders=await headers();
  const locale=resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const msg=(en:string,ko:string)=>bilingual(locale,en,ko);
  const actor = await actorFor(
    new Request("http://localhost/admin", { headers: requestHeaders }),
  );
  if (!actor) redirect(localizeHref("/sign-in?callbackURL=%2Fadmin",locale));
  if (actor.role !== "ADMIN") notFound();

  return (
    <section className="container inner-page management-page">
      <ManagementHeader eyebrow="QUIZDIP ADMIN" title={msg("Admin dashboard","관리자 대시보드")} description={msg("Manage content safety and platform operations.","콘텐츠 안전성과 플랫폼 운영 기능을 관리할 수 있어요.")}/>
      <div className="cards management-link-grid">
        <Link href={localizeHref("/admin/analytics",locale)} className="feature-card">
          <span className="symbol mint" aria-hidden="true">▥</span>
          <h2>{msg("Content analytics","콘텐츠 분석")}</h2>
          <p>{msg("Compare play starts, popular quiz packs and questions, completion and answer accuracy across periods, languages and Kids.","기간·언어·Kids별 인기 퀴즈팩과 문제, 플레이·완료율·정답률을 분석해요.")}</p>
          <span className="card-link">{msg("Explore analytics →","콘텐츠 통계 보기 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/directory",locale)} className="feature-card">
          <span className="symbol mint" aria-hidden="true">▤</span>
          <h2>{msg("Platform directory","운영 데이터 조회")}</h2>
          <p>{msg("Browse users, every quiz pack and question, and saved play records. Drill into each account's activity.","전체 사용자·퀴즈팩·문제·플레이 기록을 확인하고 사용자별 활동을 조회해요.")}</p>
          <span className="card-link">{msg("Explore records →","전체 목록 보기 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/quiz-review",locale)} className="feature-card">
          <span className="symbol mint" aria-hidden="true">✓</span>
          <h2>{msg("Reported content and Kids review","신고 콘텐츠 및 어린이용 심사")}</h2>
          <p>{msg("Review reports, high negative ratings and creator-submitted Kids quizzes.","신고·높은 부정 평가·제작자가 신청한 Kids 문제를 검토해요.")}</p>
          <span className="card-link">{msg("Open review tools →","심사 도구 열기 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/moderation",locale)} className="feature-card">
          <span className="symbol yellow" aria-hidden="true">⚑</span>
          <h2>{msg("Report moderation & creator restrictions","신고 처리 및 제작자 게시 제한")}</h2>
          <p>{msg("Review reported content, appeals and publishing restrictions. Auto-hold rules have their own settings page.","신고 콘텐츠와 이의신청, 게시 제한을 처리해요. 자동 보류 기준은 별도 설정 페이지에서 관리합니다.")}</p>
          <span className="card-link">{msg("Open moderation →","신고 관리 열기 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/features",locale)} className="feature-card">
          <span className="symbol yellow" aria-hidden="true">✦</span>
          <h2>{msg("Editorial recommendations","운영자 추천 콘텐츠")}</h2>
          <p>{msg("Schedule and manage featured questions and quiz packs independently of popular rankings.","문제·퀴즈팩 추천을 언어·대상·기간별로 편성하고 관리해요.")}</p>
          <span className="card-link">{msg("Manage Editor's Picks →","추천 콘텐츠 관리 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/packs-review",locale)} className="feature-card">
          <span className="symbol mint" aria-hidden="true">🛡️</span>
          <h2>{msg("Kids quiz pack approval","퀴즈팩 어린이 안전 심사")}</h2>
          <p>{msg("Review complete packs independently before native Kids devices can discover them.","팩 자체의 내용과 전체 문제·미디어 안전성을 심사한 뒤 어린이용으로 승인해요.")}</p>
          <span className="card-link">{msg("Review packs →","퀴즈팩 심사 →")}</span>
        </Link>
        <Link href={localizeHref("/admin/media-review",locale)} className="feature-card">
          <span className="symbol yellow" aria-hidden="true">▣</span>
          <h2>{msg("Media review","미디어 심사")}</h2>
          <p>{msg("Preview new images, audio and video. Approve directly from the list or restrict with a required reason.","이미지·오디오·동영상을 미리 보고 목록에서 바로 승인하거나 사유를 남겨 제한해요.")}</p>
          <span className="card-link">{msg("Review media →","미디어 심사 열기 →")}</span>
        </Link>
      </div>
    </section>
  );
}
