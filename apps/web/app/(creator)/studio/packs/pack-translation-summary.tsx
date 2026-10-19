"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useLocale} from "../../../../src/i18n/provider";

type Part={start:number;title:string;description:string};
type Band={minimumScore:number;title:string;description:string};
type Language={locale:string;status:string;title:string;description:string;
  sections?:Part[];closingMessage?:string;scoreReviews?:Band[]};
type Languages={languages:Language[];coverage:{locale:string;complete:boolean}[]};

function languageName(locale:string){return locale==="ko"?"한국어":locale==="en"?"English":locale;}
function requiredProgress(source?:Language,translation?:Language){
  if(!source)return null;
  const fields:Array<[string|undefined,string|undefined]>=[
    [source.title,translation?.title],[source.description,translation?.description],
    [source.closingMessage,translation?.closingMessage]
  ];
  for(const part of source.sections??[]){
    const translated=translation?.sections?.find(item=>item.start===part.start);
    fields.push([part.title,translated?.title],[part.description,translated?.description]);
  }
  for(const band of source.scoreReviews??[]){
    const translated=translation?.scoreReviews?.find(item=>item.minimumScore===band.minimumScore);
    fields.push([band.title,translated?.title],[band.description,translated?.description]);
  }
  const required=fields.filter(([text])=>Boolean(text?.trim()));
  return {done:required.filter(([,text])=>Boolean(text?.trim())).length,total:required.length};
}

export default function PackTranslationSummary({packId,sourceLocale,href}:{
  packId:string;sourceLocale:string;href:string
}){
  const locale=useLocale(),ko=locale==="ko";
  const target=sourceLocale==="ko"?"en":"ko";
  const [data,setData]=useState<Languages|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");
    void fetch("/api/v1/packs/"+encodeURIComponent(packId)+"/languages",{
      credentials:"same-origin",cache:"no-store",signal:controller.signal
    }).then(async response=>{
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.message||result.error||"Request failed");
      return result.data as Languages;
    }).then(value=>{if(!controller.signal.aborted)setData(value);})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[packId,retry]);

  const source=data?.languages.find(lang=>lang.locale===sourceLocale);
  const saved=data?.languages.find(lang=>lang.locale===target);
  const coverage=data?.coverage.find(lang=>lang.locale===target)?.complete;
  const progress=requiredProgress(source,saved);
  const state=saved?.status==="PUBLISHED"?(ko?"공개":"Published"):
    saved?.status==="HIDDEN"?(ko?"숨김":"Hidden"):
    saved?(ko?"초안":"Draft"):(ko?"번역 없음":"Not started");

  return <section className="placeholder-panel pack-translation-summary">
    <div className="studio-section-head">
      <div>
        <h2>{ko?"번역 관리":"Translations"}</h2>
        <p className="muted">{ko?"번역 상태를 확인하고 별도 화면에서 편집하세요.":"Check translation status and edit in a dedicated workspace."}</p>
      </div>
      <Link href={href} className="btn btn-outline">{ko?"번역 편집 →":"Edit translation →"}</Link>
    </div>
    {loading?<p role="status" className="muted">{ko?"번역 현황을 불러오는 중…":"Loading language status…"}</p>:
      error?<div role="alert" className="pack-translation-summary-error">
        <p>{error}</p><button type="button" className="btn btn-outline" onClick={()=>setRetry(x=>x+1)}>{ko?"다시 시도":"Retry"}</button>
      </div>:
      <div className="pack-translation-summary-list">
        <div className="pack-translation-summary-row">
          <strong>{languageName(sourceLocale)}</strong>
          <span className="media-state-chip media-ok">{ko?"원본 언어":"Original"}</span>
        </div>
        <div className="pack-translation-summary-row">
          <div>
            <strong>{languageName(target)}</strong>
            <p className="muted">{progress?(ko?
              "팩 텍스트 "+progress.done+"/"+progress.total+" · 문제 번역 "+(coverage?"완료":"미완료"):
              "Pack text "+progress.done+"/"+progress.total+" · Questions "+(coverage?"complete":"incomplete")):
              (ko?"번역 데이터 확인 필요":"Translation data unavailable")}</p>
          </div>
          <span className={"media-state-chip "+(saved?.status==="PUBLISHED"?"media-ok":"media-wait")}>{state}</span>
        </div>
      </div>}
  </section>;
}
