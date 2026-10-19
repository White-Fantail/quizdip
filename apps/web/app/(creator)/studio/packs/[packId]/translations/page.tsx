import Link from "next/link";
import {headers} from "next/headers";
import {auth} from "../../../../../../src/lib/auth";
import {resolveLocale,localizeHref} from "../../../../../../src/i18n/core";
import {listBackHref} from "../../../../../../src/lib/list-back-href";
import ManagementHeader from "../../../../../../src/components/management-header";
import PackTranslationEditor from "../../pack-translation-editor";

export const dynamic="force-dynamic";
export default async function PackTranslationsPage({params,searchParams}:{
  params:Promise<{packId:string}>;
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}){
  const {packId}=await params;
  const h=await headers(),locale=resolveLocale(h.get("x-quizdip-locale"));
  const session=await auth.api.getSession({headers:h});
  const detailHref=listBackHref(localizeHref("/studio/packs/"+packId,locale),await searchParams,["page"]);
  return <main className="container inner-page management-page pack-detail-page pack-translation-page">
    <Link href={detailHref} className="card-link">← {locale==="ko"?"팩 상세 보기":"Pack details"}</Link>
    <ManagementHeader eyebrow="QUIZDIP STUDIO / TRANSLATIONS"
      title={locale==="ko"?"퀴즈팩 번역 편집":"Edit pack translation"}
      description={locale==="ko"?"원문과 번역을 항목별로 비교하면서 작성하세요.":"Translate each item with its source text beside it."}/>
    {!session?<section className="placeholder-panel">
      <p>{locale==="ko"?"번역을 관리하려면 로그인하세요.":"Sign in to manage translations."}</p>
      <Link className="btn btn-primary" href={localizeHref("/sign-in?callbackURL="+encodeURIComponent("/studio/packs/"+packId+"/translations"),locale)}>
        {locale==="ko"?"로그인":"Sign in"}</Link>
    </section>:<PackTranslationEditor packId={packId}/>}
  </main>;
}
