import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformError } from "../../../../src/modules/platform/auth";
import { runShareGet } from "../../../../src/modules/platform/runs";
import { localizeHref } from "../../../../src/i18n/core";
import AdSlot from "../../../../src/components/ads/AdSlot";
import { publicResultMetadata, publicResultOrigin } from "../../../../src/lib/public-result-metadata";

export const dynamic = "force-dynamic";

async function sharedResult(shareId:string) {
  try{return await runShareGet({shareId});}
  catch(error){if(error instanceof PlatformError && error.status===404)notFound();throw error;}
}
export async function generateMetadata({params}:{params:Promise<{shareId:string}>}):Promise<Metadata> {
  const {shareId}=await params;
  const result=await sharedResult(shareId);
  return publicResultMetadata({
    shareId,
    locale:result.locale==="ko"?"ko":"en",
    packTitle:result.title,
    score:result.score,
    completed:result.completed,
    solved:result.solved,
    origin:publicResultOrigin(process.env),
  });
}

export default async function SharedResult({params}:{params:Promise<{shareId:string}>}) {
  const {shareId}=await params;
  const result=await sharedResult(shareId);
  const korean=result.locale==="ko";
  const packHref=localizeHref("/packs/"+result.packId,result.locale==="ko"?"ko":"en");
  return <main className="container inner-page management-page shared-result-page">
    <div className="play-intro">
      <span className="eyebrow">QUIZDIP · {korean?"공유된 결과":"SHARED RESULT"}</span>
      <h1>{korean?"나의 퀴즈팩 도전 결과":"A quiz pack result"}</h1>
      <p className="lead">{result.title}</p>
    </div>
    <section className="shared-result-detail">
      <img src={`/results/${shareId}/og?v=4`}
        width={1200} height={630} alt={korean?`${result.title} · ${result.score}점`:`${result.title} · ${result.score} points`}/>
      <div className="shared-result-stats">
        <strong>{result.score.toLocaleString(korean?"ko-KR":"en-US")}{korean?"점":" pts"}</strong>
        <span>{korean?`정답 ${result.solved}/${result.completed} · 완료 ${result.completed}문제`:
          `${result.solved}/${result.completed} correct · ${result.completed} completed`}</span>
      </div>
      <Link href={packHref} className="btn btn-primary">
        {korean?"이 퀴즈팩 도전하기 →":"Try this quiz pack →"}
      </Link>
    </section>
    <AdSlot placement="SHARED_RESULT" kids={result.kidsEligible}/>
  </main>;
}
