import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
import { INDEX_ORIGIN, canonicalUrl } from "../../../src/lib/search-indexing";
import type { Metadata } from "next";
import { publicDiscoverPreview } from "../../../src/modules/platform/public-discover-preview";

export async function generateMetadata():Promise<Metadata>{
  const locale=resolveLocale((await headers()).get("x-quizdip-locale"));
  const title=locale==="ko"?"퀴즈 발견하기 · QuizDip":"Discover questions · QuizDip";
  const description=locale==="ko"
    ?"새로운 퀴즈를 찾아 단서를 확인하고 답을 추리해 보세요. 다양한 주제의 공개 퀴즈팩도 만나보세요."
    :"Discover questions and published quiz packs, reason through progressive clues and try a new challenge.";
  const url=canonicalUrl(localizeHref("/discover",locale));
  return {title,description,metadataBase:new URL(INDEX_ORIGIN),
    alternates:{canonical:url,languages:{
      en:canonicalUrl("/en/discover"),ko:canonicalUrl("/ko/discover")
    }},openGraph:{title,description,url,siteName:"QuizDip",type:"website"}};
}

export default async function DiscoverLayout({children}:{children:React.ReactNode}) {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const previews=await publicDiscoverPreview(locale).catch(()=>[]);
  return <>
    {children}
    {previews.length>0&&<section className="container section" aria-labelledby="public-quiz-preview">
      <h2 id="public-quiz-preview">{locale==="ko"?"실제 공개 문제 미리보기":"Preview published questions"}</h2>
      <p className="muted">{locale==="ko"
        ?"지금 플레이할 수 있는 문제의 제목과 질문입니다. 정답과 단서는 플레이 중 확인하세요."
        :"Browse real playable prompts. Answers and hidden clues stay inside each game."}</p>
      <div className="discover-grid">
        {previews.map(quiz=><article className="feature-card discover-card" key={quiz.id}>
          <h3>{quiz.title}</h3>
          <p className="discover-card-description" style={{whiteSpace:"pre-wrap"}}>{quiz.prompt}</p>
          <Link href={localizeHref("/play/"+quiz.id,locale)} className="btn btn-outline discover-play-link">
            {locale==="ko"?"문제 풀기":"Play this question"}
          </Link>
        </article>)}
      </div>
    </section>}
    <section className="container section" aria-labelledby="browse-full-library">
      <h2 id="browse-full-library">{locale==="ko"?"퀴즈팩 내용을 먼저 살펴보고 싶다면":"Want to read about a pack before playing?"}</h2>
      <p className="muted">{locale==="ko"
        ?"공개 퀴즈팩 목록에서는 각 팩의 주제와 제작자 소개, 문제 수를 바로 읽을 수 있습니다. 게임의 정답이나 아직 열지 않은 단서는 미리 공개하지 않습니다."
        :"The public pack library shows each pack's topic, creator description and question count. Answers and unrevealed clues stay inside the game."}</p>
      <Link className="btn btn-outline" href={localizeHref("/packs",locale)}>{locale==="ko"?"퀴즈팩 전체 목록 열기":"Browse the full pack library"}</Link>
    </section>
  </>;
}
