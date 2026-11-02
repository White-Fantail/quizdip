import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { localizeHref, resolveLocale } from "../../../src/i18n/core";
import { canonicalUrl, INDEX_ORIGIN } from "../../../src/lib/search-indexing";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const title = locale === "ko" ? "QuizDip 소개 및 콘텐츠 원칙" : "About QuizDip & content standards";
  const description = locale === "ko"
    ? "퀴즈딥의 단서 기반 퀴즈, 퀴즈팩 제작, 피드백, 수정 및 어린이 콘텐츠 검토 과정을 안내합니다."
    : "How QuizDip's clue-based quizzes, creator packs, feedback, revisions and Kids review work.";
  const url = canonicalUrl(localizeHref("/about", locale));
  return {title, description, metadataBase:new URL(INDEX_ORIGIN),
    alternates:{canonical:url}, openGraph:{title,description,url,siteName:"QuizDip",type:"website"}};
}

export default async function AboutPage() {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const ko = locale === "ko";
  const url = (path:string) => localizeHref(path, locale);
  return <main className="container inner-page management-page">
    <div className="play-intro">
      <span className="eyebrow">QUIZDIP · ABOUT</span>
      <h1>{ko?"퀴즈딥은 단서를 따라 발견하는 퀴즈 놀이터입니다.":"Learn by following the clues."}</h1>
      <p className="lead">{ko
        ?"하나의 정답을 바로 보여주기보다, 정보를 조금씩 연결하며 추리하는 즐거움을 만들고 싶습니다."
        :"Instead of showing the answer up front, QuizDip invites you to connect pieces of evidence and enjoy discovering it yourself."}</p>
    </div>
    <section className="feature-card">
      <h2>{ko?"게임과 퀴즈팩":"Questions and packs"}</h2>
      <p>{ko
        ?"문제마다 글, 이미지 또는 다른 형태의 단서가 사용될 수 있습니다. 일부 문제는 객관식이며, 다른 문제는 직접 답을 입력합니다. 단서의 수와 난이도는 문제마다 다릅니다."
        :"Questions may use written, visual or other clues. Some ask you to pick an option, while others ask you to enter an answer. Clue counts and difficulty vary by question."}</p>
      <p>{ko
        ?"퀴즈팩은 여러 문제를 한 가지 주제나 시리즈로 엮습니다. 제작자가 작성한 소개를 읽고 원하는 팩을 선택한 뒤, 정해진 순서나 랜덤 순서로 도전할 수 있습니다."
        :"A pack collects several questions into a theme or series. Read its creator-written introduction, choose a topic and play in the creator's order or a shuffled order."}</p>
      <Link className="btn btn-outline" href={url("/packs")}>{ko?"공개된 퀴즈팩 살펴보기":"Explore published quiz packs"}</Link>
    </section>
    <section className="feature-card">
      <h2>{ko?"콘텐츠 제작과 신뢰성":"Creation and reliability"}</h2>
      <p>{ko
        ?"퀴즈딥은 커뮤니티 제작 콘텐츠를 다루며, 제작 과정에서 AI 도구가 사용될 수 있습니다. 모든 문제가 전문가에 의해 독립 검증되었다고 보증하지 않습니다. 특히 최신 정보, 역사·과학 상식 등은 해설과 원문 출처를 비교해 확인해 주세요."
        :"QuizDip hosts creator-made content, and creators may use AI tools when preparing it. We do not claim that every question has been independently fact-checked by a subject expert. For changing facts or technical topics, consult the explanation and its original sources where provided."}</p>
      <p>{ko
        ?"제작자는 공개한 문제를 수정할 수 있습니다. 퀴즈팩 버전은 수정 전후의 결과를 구분하는 데 사용됩니다. 팩 소개와 해설은 각각의 제작자가 제공하므로 상세 수준이 다를 수 있습니다."
        :"Creators can revise published questions. Pack versions help distinguish results made with different content. The depth of pack descriptions, explanations and cited sources varies by creator."}</p>
    </section>
    <section className="feature-card">
      <h2>{ko?"피드백 및 안전":"Feedback and safety"}</h2>
      <p>{ko
        ?"퀴즈팩 페이지에서 평가를 남기거나 문제가 있는 내용을 신고할 수 있습니다. 신고는 오류, 부적절한 내용, 중복과 같은 문제를 검토하는 데 도움이 됩니다. 일반 공개와 어린이용 노출은 별도로 관리되며, 어린이용 콘텐츠는 추가 검토를 거칩니다."
        :"Players can rate packs and report questionable content, including factual errors, inappropriate material or duplicates. General publication and Kids eligibility are separate: Kids exposure requires additional safety review."}</p>
      <p>{ko
        ?"재미있는 퀴즈를 제공하는 것과 동시에, 오류를 발견했을 때 수정할 수 있는 구조를 중요하게 생각합니다."
        :"Good puzzles should be enjoyable, but they should also be open to corrections when people find mistakes."}</p>
    </section>
    <div className="actions">
      <Link className="btn btn-primary" href={url("/discover")}>{ko?"퀴즈 찾아보기":"Discover quizzes"}</Link>
      <Link className="btn btn-outline" href={url("/studio")}>{ko?"퀴즈 제작하기":"Create your own"}</Link>
    </div>
  </main>;
}
