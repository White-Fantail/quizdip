import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { localizeHref, resolveLocale } from "../../../src/i18n/core";
import { INDEX_ORIGIN, canonicalUrl } from "../../../src/lib/search-indexing";
export async function generateMetadata():Promise<Metadata>{
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const title=locale==="ko"?"문의하기 · QuizDip":"Contact QuizDip";
  const description=locale==="ko"?"QuizDip 피드백과 비공개 문의 방법 안내":"Ways to submit public feedback and private support requests.";
  const url=canonicalUrl(localizeHref("/contact",locale));
  return {title,description,metadataBase:new URL(INDEX_ORIGIN),
    alternates:{canonical:url,languages:{en:canonicalUrl("/en/contact"),ko:canonicalUrl("/ko/contact")}},
    openGraph:{title,description,url,siteName:"QuizDip",type:"website"}};
}

const ISSUES_URL="https://github.com/White-Fantail/quizdip/issues/new";
function supportEmail():string|null{
  const value=process.env.QUIZDIP_SUPPORT_EMAIL?.trim()??"";
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)?value:null;
}
export default async function ContactPage(){
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const ko=locale==="ko",email=supportEmail();const href=(path:string)=>localizeHref(path,locale);
  return <main className="container inner-page management-page">
    <div className="play-intro"><span className="eyebrow">QUIZDIP · CONTACT</span>
      <h1>{ko?"문의하기":"Contact QuizDip"}</h1>
      <p className="lead">{ko?"콘텐츠 오류, 의견 및 비공개 문의 방법입니다.":"Options for content reports, feedback and private questions."}</p>
    </div>
    <section className="feature-card"><h2>{ko?"콘텐츠 오류 신고":"Report a quiz problem"}</h2>
      <p>{ko
        ?"퀴즈팩의 오답·단서 오류·부적절한 내용은 해당 팩의 신고 기능을 이용해 주세요. 신고된 내용은 콘텐츠 검토 절차로 전달됩니다."
        :"For incorrect answers, clues or inappropriate content, use the report control on the relevant pack page. Reports feed into content review."}</p>
      <Link className="btn btn-outline" href={href("/packs")}>{ko?"퀴즈팩 목록":"Quiz packs"}</Link>
    </section>
    <section className="feature-card"><h2>{ko?"일반 의견·버그 신고 (공개)":"General feedback and bugs (public)"}</h2>
      <p>{ko
        ?"기능 제안과 공개 가능한 버그 정보는 QuizDip GitHub 이슈로 전달할 수 있습니다. GitHub 계정이 필요할 수 있습니다."
        :"Suggestions and non-sensitive bug reports can be posted in QuizDip's public GitHub issues. A GitHub account may be required."}</p>
      <p className="muted"><strong>{ko?"주의":"Important"}: </strong>{ko
        ?"GitHub 이슈는 공개됩니다. 이메일, 개인정보, 인증정보 등을 남기지 마세요."
        :"GitHub issues are public. Do not include emails, personal information or credentials."}</p>
      <a className="btn btn-outline" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
        {ko?"공개 이슈 작성하기":"Open a public issue"}
      </a>
    </section>
    <section className="feature-card"><h2>{ko?"비공개·개인정보 문의":"Private and privacy inquiries"}</h2>
      {email?<><p>{ko
        ?"계정 정보 열람·정정·삭제 등 비공개 문의는 아래 이메일로 연락해 주세요. 처음부터 비밀번호나 민감한 첨부파일을 보내지 마세요."
        :"For access, correction, deletion or private support, contact the verified mailbox below. Do not send passwords or sensitive attachments in your first message."}</p>
        <a className="btn btn-primary" href={"mailto:"+email+"?subject="+encodeURIComponent("QuizDip private support")}>{email}</a>
      </>:<p>{ko
        ?"현재 확인된 비공개 지원 이메일이 설정되어 있지 않습니다. 개인정보 요청이나 민감한 정보를 공개 GitHub 이슈에 게시하지 마세요. 운영자가 확인된 이메일을 설정하면 이곳에 표시됩니다."
        :"A verified private support inbox is not yet configured. Do not post private information or privacy requests on GitHub. Once the operator configures a verified email, it will appear here."}</p>}
      <p className="muted">{ko?"계정 정보 관련 요청에는 본인 확인이 필요할 수 있습니다.":"Account-data requests may require identity verification."}</p>
      <Link className="btn btn-outline" href={href("/privacy")}>{ko?"개인정보처리방침":"Privacy notice"}</Link>
    </section>
  </main>;
}
