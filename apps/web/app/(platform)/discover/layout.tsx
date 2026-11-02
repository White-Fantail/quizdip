import Link from "next/link";
import { headers } from "next/headers";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";

export default async function DiscoverLayout({children}:{children:React.ReactNode}) {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  return <>
    {children}
    <section className="container section" aria-labelledby="browse-full-library">
      <h2 id="browse-full-library">{locale==="ko"?"퀴즈팩 내용을 먼저 살펴보고 싶다면":"Want to read about a pack before playing?"}</h2>
      <p className="muted">{locale==="ko"
        ?"공개 퀴즈팩 목록에서는 각 팩의 주제와 제작자 소개, 문제 수를 바로 읽을 수 있습니다. 게임의 정답이나 아직 열지 않은 단서는 미리 공개하지 않습니다."
        :"The public pack library shows each pack's topic, creator description and question count. Answers and unrevealed clues stay inside the game."}</p>
      <Link className="btn btn-outline" href={localizeHref("/packs",locale)}>{locale==="ko"?"퀴즈팩 전체 목록 열기":"Browse the full pack library"}</Link>
    </section>
  </>;
}
