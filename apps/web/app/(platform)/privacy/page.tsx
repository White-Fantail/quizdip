import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { localizeHref, resolveLocale } from "../../../src/i18n/core";
import { INDEX_ORIGIN, canonicalUrl } from "../../../src/lib/search-indexing";
export async function generateMetadata():Promise<Metadata>{
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const title=locale==="ko"?"개인정보처리방침 · QuizDip":"Privacy notice · QuizDip";
  const description=locale==="ko"?"수집 정보와 사용 목적, 쿠키·서비스 제공업체 및 개인정보 요청 방법":"How QuizDip processes account, gameplay and analytics data and privacy requests.";
  const url=canonicalUrl(localizeHref("/privacy",locale));
  return {title,description,metadataBase:new URL(INDEX_ORIGIN),
    alternates:{canonical:url,languages:{en:canonicalUrl("/en/privacy"),ko:canonicalUrl("/ko/privacy")}},
    openGraph:{title,description,url,siteName:"QuizDip",type:"website"}};
}

export default async function PrivacyPage(){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const ko=locale==="ko";const href=(path:string)=>localizeHref(path,locale);
  return <main className="container inner-page management-page">
    <div className="play-intro"><span className="eyebrow">QUIZDIP · PRIVACY</span>
      <h1>{ko?"개인정보처리방침":"Privacy notice"}</h1>
      <p className="lead">{ko?"QuizDip 서비스 이용 중 처리되는 정보와 목적을 안내합니다.":"How QuizDip handles information as you use the service."}</p>
      <p className="muted">{ko?"최종 업데이트: 2026년 11월 12일":"Last updated: 12 November 2026"}</p>
    </div>
    <section className="feature-card"><h2>{ko?"처리하는 정보와 사용 목적":"Information and purposes"}</h2>
      <p>{ko
        ?"Google·Apple 로그인 시 제공되는 계정 식별정보, 표시 이름 및 필요한 경우 이메일, 사용자가 작성한 퀴즈·팩, 제출한 답변, 플레이 기록과 결과, 평가·신고 및 언어 설정을 처리할 수 있습니다. 비회원 플레이 진행 상태는 브라우저에도 저장될 수 있습니다."
        :"QuizDip may process account IDs, display names and relevant email data supplied by Google or Apple sign-in; submitted quizzes and packs; guesses, play history and results; ratings, reports and language preferences. Guest progress may be stored in the browser."}</p>
      <p>{ko
        ?"이 정보는 로그인, 게임 진행, 계정 관리, 콘텐츠 검토, 보안·부정 이용 방지 및 서비스 개선에 사용합니다."
        :"We use this data to provide sign-in, gameplay, account management, content review, security, anti-abuse protection and service improvements."}</p>
    </section>
    <section className="feature-card"><h2>{ko?"쿠키·분석·광고":"Cookies, analytics and advertising"}</h2>
      <p>{ko
        ?"로그인과 설정 유지를 위해 쿠키 또는 브라우저 저장소가 사용될 수 있습니다. Vercel Analytics와 Speed Insights가 이용 및 성능 관련 정보를 처리할 수 있습니다. 브라우저의 쿠키 차단은 일부 기능에 영향을 줄 수 있습니다."
        :"Cookies or browser storage may support sign-in and preferences. Vercel Analytics and Speed Insights may process usage and performance information. Blocking browser storage can affect some functionality."}</p>
      <p>{ko
        ?"Google AdSense 광고는 운영 및 개인정보 보호 준비 설정이 충족된 경우에만 활성화됩니다. 활성화 시 Google의 광고 데이터 처리와 쿠키 정책이 적용될 수 있습니다. 어린이용 화면에는 광고를 표시하지 않도록 설계되어 있습니다."
        :"Google AdSense is enabled only when operating and privacy-readiness settings permit it. When active, Google's advertising data and cookie practices may apply. Dedicated Kids experiences are designed to be ad-free."}</p>
    </section>
    <section className="feature-card"><h2>{ko?"외부 제공업체와 보존":"Providers and retention"}</h2>
      <p>{ko
        ?"호스팅·분석에 Vercel, 데이터베이스 서비스, 미디어에 Cloudflare R2, 선택한 로그인에 Google·Apple 등을 사용할 수 있습니다. 이용자가 승인한 외부 앱은 허용된 범위의 계정 데이터에 접근할 수 있습니다. 정보는 뉴질랜드 밖에서 처리될 수 있습니다."
        :"Services may include Vercel for hosting and analytics, database infrastructure, Cloudflare R2 for media, and Google or Apple for chosen sign-in providers. Authorized external apps can access approved account scopes. Processing may occur outside New Zealand."}</p>
      <p>{ko
        ?"정보는 서비스 운영, 보안, 문제 조사 또는 법적 의무에 필요한 기간 동안 보존될 수 있습니다. 기록마다 보존 기간이 다르므로 즉시 자동 삭제를 보장하지 않습니다."
        :"Records may be retained as needed for service operations, security, investigations or legal obligations. Retention varies by record; immediate automatic deletion is not guaranteed."}</p>
    </section>
    <section className="feature-card"><h2>{ko?"어린이 정보 및 권리":"Kids and your rights"}</h2>
      <p>{ko
        ?"어린이용 기능에는 보호자 연결과 별도 접근·안전 정책을 적용합니다. 본인 정보의 열람·정정·삭제 요청이나 비공개 문의는 문의 페이지의 안내를 확인하세요. 개인정보 또는 로그인 정보를 공개 GitHub 이슈에 게시하지 마세요."
        :"Kids features use guardian pairing and separate access and safety controls. For access, correction, deletion or confidential questions, see Contact. Never post personal details or login credentials in public GitHub issues."}</p>
      <div className="actions"><Link className="btn btn-outline" href={href("/contact")}>{ko?"문의하기":"Contact"}</Link>
      <Link className="btn btn-outline" href={href("/terms")}>{ko?"이용 안내":"Terms"}</Link></div>
    </section>
  </main>;
}
