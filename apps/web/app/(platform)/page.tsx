import Link from "next/link";
import { headers } from "next/headers";
import { localizeHref, resolveLocale } from "../../src/i18n/core";
import { t } from "../../src/i18n/messages";
import LeaderboardSpotlight from "../../src/components/leaderboard-spotlight";
import HomeFeaturedQuiz from "../../src/components/home-featured-quiz";
import {quizList} from "../../src/modules/platform/quiz";

export default async function HomePage() {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const msg = (key: Parameters<typeof t>[1]) => t(locale, key);
  const url = (path: string) => localizeHref(path, locale);
  // Show a real, currently published General question. Failure must not block the homepage.
  const sample=await quizList({limit:80,offset:0,locale,mine:false,kids:false},null)
    .then(data=>data.items.filter(q=>typeof q.prompt==="string"&&q.prompt.length>=20&&q.prompt.length<=170))
    .catch(()=>[]);
  const selected=sample.length?sample[Math.floor(Date.now()/86400000)%Math.min(sample.length,36)]:null;
  const teaser=selected?{id:selected.id,title:selected.title,prompt:selected.prompt}:null;
  return (
    <div className="container">
      <section className="hero">
        <div className="eyebrow">A LITTLE QUIZ. A LOT OF FUN.</div>
        <h1>{msg("home.title1")}<br /><span className="purple">{msg("home.title2")}</span></h1>
        <p className="lead">{locale==="ko"?"설명은 잠깐 미뤄두고, 첫 문제부터 맞혀볼까요?":"Skip the tour. Take your first guess."}</p>
        <HomeFeaturedQuiz locale={locale} quiz={teaser}/>
        <div className="actions">
          <Link className="btn btn-outline" href={url("/packs")}>{locale==="ko"?"좋아하는 주제 찾기":"Explore a favorite topic"}</Link>
          <Link className="btn btn-outline" href={url("/studio")}>{msg("home.create")}</Link>
        </div>
        <div className="hero-stickers" aria-hidden="true"><span>?</span><span>✦</span><span>!</span></div>
      </section>
      <section className="section">
        <h2>{msg("home.heading")}</h2>
        <p className="muted">{msg("home.intro")}</p>
        <div className="cards">
          <Link href={url("/discover")} className="feature-card"><span className="symbol mint">✧</span><h3>Discover</h3><p>{msg("home.discoverText")}</p><span className="card-link">{msg("home.discoverAction")}</span></Link>
          <Link href={url("/play")} className="feature-card"><span className="symbol yellow">?</span><h3>Play</h3><p>{msg("home.playText")}</p><span className="card-link">{msg("home.playAction")}</span></Link>
          <Link href={url("/studio")} className="feature-card"><span className="symbol coral">✎</span><h3>Studio</h3><p>{msg("home.studioText")}</p><span className="card-link">{msg("home.studioAction")}</span></Link>
        </div>
      </section>
      <section className="section" aria-labelledby="how-it-works">
        <h2 id="how-it-works">{locale === "ko" ? "퀴즈딥을 즐기는 방법" : "What makes a QuizDip?"}</h2>
        <p className="muted">{locale === "ko"
          ? "퀴즈딥은 단서를 하나씩 확인하며 추리하는 퀴즈 놀이터입니다. 답을 외우기보다 발견하는 과정을 즐겨보세요."
          : "QuizDip is a place to reason through clues, make a guess, and learn something new along the way."}</p>
        <div className="cards">
          <article className="feature-card">
            <h3>{locale === "ko" ? "단서를 따라 추리" : "Reason through clues"}</h3>
            <p>{locale === "ko"
              ? "문제에 따라 글이나 이미지 등 다른 형태의 단서가 차례로 열립니다. 어려우면 다음 단서를 요청하세요."
              : "Depending on the question, text or visual clues appear progressively. Need more evidence? Reveal another clue."}</p>
          </article>
          <article className="feature-card">
            <h3>{locale === "ko" ? "한 주제를 깊게" : "Explore a full topic"}</h3>
            <p>{locale === "ko"
              ? "퀴즈팩은 여러 문제를 한 흐름으로 묶습니다. 팩 소개를 읽고 좋아하는 주제를 골라 도전해 보세요."
              : "Packs bring questions together around a theme. Read the creator's introduction before choosing a challenge."}</p>
          </article>
          <article className="feature-card">
            <h3>{locale === "ko" ? "설명과 피드백" : "Explanations and feedback"}</h3>
            <p>{locale === "ko"
              ? "문제에 해설이 제공되면 플레이 후 살펴볼 수 있습니다. 오류나 부적절한 내용은 신고할 수 있어요."
              : "Where available, explanations add context after a round. Players can report inaccurate or inappropriate content."}</p>
          </article>
        </div>
        <div className="actions">
          <Link className="btn btn-outline" href={url("/packs")}>{locale === "ko" ? "전체 퀴즈팩 살펴보기" : "Browse the quiz pack library"}</Link>
          <Link className="btn btn-outline" href={url("/about")}>{locale === "ko" ? "콘텐츠 제작과 운영 원칙" : "How we handle content"}</Link>
        </div>
      </section>
      <LeaderboardSpotlight />
      <section className="note-strip"><b>Create it. Play it. Share it.</b><span>{msg("home.tagline")}</span></section>
    </div>
  );
}
