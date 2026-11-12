import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { localizeHref, resolveLocale } from "../../../src/i18n/core";
import { INDEX_ORIGIN, canonicalUrl } from "../../../src/lib/search-indexing";
export async function generateMetadata():Promise<Metadata>{
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const title=locale==="ko"?"서비스 이용 안내 · QuizDip":"Terms of use · QuizDip";
  const description=locale==="ko"?"QuizDip 이용·콘텐츠 제작 및 신고 안내":"QuizDip use, creator responsibilities and content reporting.";
  const url=canonicalUrl(localizeHref("/terms",locale));
  return {title,description,metadataBase:new URL(INDEX_ORIGIN),
    alternates:{canonical:url,languages:{en:canonicalUrl("/en/terms"),ko:canonicalUrl("/ko/terms")}},
    openGraph:{title,description,url,siteName:"QuizDip",type:"website"}};
}

export default async function TermsPage(){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const ko=locale==="ko";const href=(path:string)=>localizeHref(path,locale);
  return <main className="container inner-page management-page">
    <div className="play-intro"><span className="eyebrow">QUIZDIP · TERMS</span>
      <h1>{ko?"서비스 이용 안내":"Terms of use"}</h1>
      <p className="muted">{ko?"최종 업데이트: 2026년 11월 12일":"Last updated: 12 November 2026"}</p>
      <p className="lead">{ko?"퀴즈를 만들고 풀고 나눌 때의 기본 원칙입니다.":"Guidance for creating, playing and sharing quizzes."}</p>
    </div>
    <section className="feature-card"><h2>{ko?"정확성과 이용":"Accuracy and intended use"}</h2>
      <p>{ko
        ?"커뮤니티 제작 퀴즈에는 오류나 오래된 정보가 포함될 수 있으며 AI가 제작에 사용될 수 있습니다. 퀴즈와 해설은 오락·일반 학습 목적이며 전문 조언을 대신하지 않습니다."
        :"Community-created quizzes may contain mistakes or outdated information, and AI may assist their creation. Questions and explanations are for entertainment and general learning, not professional advice."}</p>
    </section>
    <section className="feature-card"><h2>{ko?"제작자와 플레이어":"Creators and players"}</h2>
      <p>{ko
        ?"공유할 권리가 있는 콘텐츠만 올리고 저작권과 개인정보를 존중해 주세요. 유해 콘텐츠, 허위 정보, 스팸 및 악용은 제한될 수 있습니다. 문제 수정 시 버전으로 결과를 구분합니다."
        :"Share only content you have rights to use. Respect copyright and privacy; abuse, harmful content and spam may be restricted. Quiz revisions use versioned results."}</p>
      <p>{ko
        ?"외부 앱 연결 시 권한을 확인하세요. 어린이용 콘텐츠 노출은 별도 승인 기준을 적용합니다."
        :"Review permissions when authorizing external apps. Kids exposure requires separate safety eligibility."}</p>
      <div className="actions"><Link className="btn btn-outline" href={href("/contact")}>{ko?"문의하기":"Contact"}</Link>
      <Link className="btn btn-outline" href={href("/privacy")}>{ko?"개인정보처리방침":"Privacy"}</Link></div>
    </section>
  </main>;
}
