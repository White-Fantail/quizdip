"use client";

import Link from "next/link";
import {useEffect,useState,type ReactNode} from "react";
import {useLocale} from "../../../../src/i18n/provider";
import {localizeHref} from "../../../../src/i18n/core";

type Part={start:number;title:string;description:string};
type Band={minimumScore:number;title:string;description:string};
type Language={locale:string;status:string;title:string;description:string;
  sections?:Part[];closingMessage?:string;scoreReviews?:Band[]};
type LanguageResult={sourceLocale:string;languages:Language[];coverage:{locale:string;complete:boolean}[]};
type Draft={title:string;description:string;sections:Part[];closingMessage:string;scoreReviews:Band[]};

async function request(path:string,method="GET",body?:object){
  const response=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,
    body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.message||json.error||"Request failed");
  return json.data;
}
function languageName(locale:string){return locale==="ko"?"한국어":locale==="en"?"English":locale;}
function draftFrom(data:LanguageResult):Draft{
  const source=data.languages.find(lang=>lang.locale===data.sourceLocale);
  const target=data.sourceLocale==="ko"?"en":"ko";
  const saved=data.languages.find(lang=>lang.locale===target);
  return {
    title:saved?.title??"",description:saved?.description??"",
    sections:(source?.sections??[]).map(part=>{
      const translated=saved?.sections?.find(candidate=>candidate.start===part.start);
      return {start:part.start,title:translated?.title??"",description:translated?.description??""};
    }),
    closingMessage:saved?.closingMessage??"",
    scoreReviews:(source?.scoreReviews??[]).map(band=>{
      const translated=saved?.scoreReviews?.find(candidate=>candidate.minimumScore===band.minimumScore);
      return {minimumScore:band.minimumScore,title:translated?.title??"",description:translated?.description??""};
    })
  };
}
function progress(source:Language|undefined,draft:Draft){
  const required:Array<[string|undefined,string|undefined]>=[
    [source?.title,draft.title],[source?.description,draft.description],
    [source?.closingMessage,draft.closingMessage]
  ];
  for(const part of source?.sections??[]){
    const translated=draft.sections.find(candidate=>candidate.start===part.start);
    required.push([part.title,translated?.title],[part.description,translated?.description]);
  }
  for(const band of source?.scoreReviews??[]){
    const translated=draft.scoreReviews.find(candidate=>candidate.minimumScore===band.minimumScore);
    required.push([band.title,translated?.title],[band.description,translated?.description]);
  }
  const fields=required.filter(([original])=>Boolean(original?.trim()));
  const done=fields.filter(([,translated])=>Boolean(translated?.trim())).length;
  return {done,total:fields.length};
}
function Pair({label,original,value,onChange,sourceLanguage,targetLanguage,multiline=false,maxLength,placeholder}:{
  label:string;original:string|undefined;value:string;onChange:(next:string)=>void;
  sourceLanguage:string;targetLanguage:string;multiline?:boolean;maxLength:number;placeholder:string;
}){
  const missing=Boolean(original?.trim())&&!value.trim();
  return <div className="pack-translation-pair">
    <h4>{label}{missing&&<span className="pack-translation-missing"> · {placeholder}</span>}</h4>
    <div className="pack-translation-columns">
      <div className="pack-translation-source">
        <span className="pack-translation-field-label">{sourceLanguage} · {label}</span>
        <div className="pack-translation-original">{original?.trim()||"—"}</div>
      </div>
      <label className="pack-translation-target">
        <span className="pack-translation-field-label">{targetLanguage} · {label}</span>
        {multiline?<textarea rows={3} maxLength={maxLength} value={value}
          onChange={e=>onChange(e.target.value)}/>:
          <input maxLength={maxLength} value={value} onChange={e=>onChange(e.target.value)}/>}
      </label>
    </div>
  </div>;
}
function Entry({title,status,children,initiallyOpen=false}:{
  title:string;status:string;children:ReactNode;initiallyOpen?:boolean;
}){
  return <details className="pack-translation-entry" open={initiallyOpen}>
    <summary><strong>{title}</strong><span className="pack-translation-entry-status">{status}</span></summary>
    <div className="pack-translation-entry-body">{children}</div>
  </details>;
}

/** The backend owns publication validation; source order, media and score thresholds stay immutable. */
export default function PackTranslationEditor({packId}:{packId:string}){
  const locale=useLocale(),ko=locale==="ko";
  const [data,setData]=useState<LanguageResult|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(""),[error,setError]=useState("");
  const [dirty,setDirty]=useState(false),[retry,setRetry]=useState(0);

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    void request("/packs/"+encodeURIComponent(packId)+"/languages").then((value:LanguageResult)=>{
      if(!active)return;
      setData(value);setDraft(draftFrom(value));setDirty(false);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[packId,retry]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);

  const sourceLocale=data?.sourceLocale;
  const target=sourceLocale==="ko"?"en":sourceLocale==="en"?"ko":null;
  const source=data?.languages.find(lang=>lang.locale===sourceLocale);
  const saved=data?.languages.find(lang=>lang.locale===target);
  const complete=data?.coverage.find(entry=>entry.locale===target)?.complete===true;
  const counts=draft?progress(source,draft):null;
  const missing=(counts?.total??0)-(counts?.done??0);
  const change=(next:Draft)=>{setDraft(next);setDirty(true);setMessage("");};
  async function save(status:"DRAFT"|"PUBLISHED"){
    if(!draft||!target||busy)return;
    if(status==="PUBLISHED"){
      if(!complete||missing>0||!draft.title.trim())return;
      if(!window.confirm(ko?
        "팩 텍스트와 모든 문제의 번역을 검토했습니다. 번역본을 공개할까요?":
        "Have you reviewed all pack text and question translations? Publish this translation?"))return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      await request("/packs/"+encodeURIComponent(packId)+"/languages/"+target,"PUT",{
        locale:target,...draft,status,confirm:status==="PUBLISHED"
      });
      const next=await request("/packs/"+encodeURIComponent(packId)+"/languages") as LanguageResult;
      setData(next);setDraft(draftFrom(next));setDirty(false);
      setMessage(status==="PUBLISHED"?(ko?"번역본을 공개했습니다.":"Translation published.") :
        (ko?"번역 초안을 저장했습니다.":"Translation draft saved."));
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  if(loading)return <section className="placeholder-panel" role="status">
    {ko?"번역 정보를 불러오는 중…":"Loading translation…"}</section>;
  if(!data||!draft||!target)return <section className="placeholder-panel" role="alert">
    <h2>{ko?"번역을 불러올 수 없습니다":"Translation unavailable"}</h2>
    <p>{error||(ko?"지원되지 않는 원본 언어입니다.":"This source language is not supported.")}</p>
    <button type="button" className="btn btn-outline" onClick={()=>setRetry(n=>n+1)}>{ko?"다시 시도":"Retry"}</button>
  </section>;

  const sourceName=languageName(sourceLocale!),targetName=languageName(target);
  const status=saved?.status==="PUBLISHED"?(ko?"공개":"Published"):
    saved?.status==="HIDDEN"?(ko?"숨김":"Hidden"):
    saved?(ko?"초안":"Draft"):(ko?"미작성":"Not started");
  const pair=(label:string,original:string|undefined,value:string,onChange:(next:string)=>void,
    multiline:boolean,maxLength:number)=><Pair label={label} original={original} value={value}
      onChange={onChange} sourceLanguage={sourceName} targetLanguage={targetName}
      multiline={multiline} maxLength={maxLength} placeholder={ko?"미번역":"Missing"}/>;
  const sectionStatus=(original:Part,translated:Part)=>{
    const needed=[original.title,original.description].filter(Boolean).length;
    const filled=[original.title.trim()?translated.title:"",original.description.trim()?translated.description:""].filter(Boolean).length;
    return filled===needed?(ko?"완료":"Complete"):(ko?"미완료":"Incomplete");
  };
  return <div className="pack-translation-workspace">
    <section className="placeholder-panel pack-translation-overview">
      <div className="studio-section-head">
        <div>
          <h2>{sourceName} → {targetName}</h2>
          <p className="muted">{ko?
            "원문의 문제 순서, 파트 이미지, 점수 기준은 그대로 유지됩니다.":
            "Question order, chapter images and score thresholds stay unchanged."}</p>
        </div>
        <span className={"media-state-chip "+(saved?.status==="PUBLISHED"?"media-ok":"media-wait")}>{status}</span>
      </div>
      <div className="pack-translation-progress" aria-live="polite">
        <div><strong>{ko?"팩 텍스트":"Pack text"}</strong><span>{counts?.done??0} / {counts?.total??0}</span></div>
        <div className="pack-translation-progress-track" role="progressbar"
          aria-label={ko?"팩 텍스트 번역 진행률":"Pack text translation progress"} aria-valuemin={0}
          aria-valuemax={counts?.total||1} aria-valuenow={counts?.done??0}>
          <span style={{width:((counts?.done??0)/Math.max(1,counts?.total??0))*100+"%"}}/>
        </div>
        <p className="muted">{ko?
          "문제 번역: "+(complete?"완료":"미완료")+" · 문제별 번역은 각 문제의 편집 화면에서 관리합니다.":
          "Question translations: "+(complete?"Complete":"Incomplete")+". Edit question translations from each question's page."}</p>
        <Link href={localizeHref("/studio/packs/"+packId,locale)} className="card-link">
          {ko?"팩 상세에서 문제 목록 보기 →":"View questions in pack details →"}</Link>
      </div>
    </section>

    <section className="placeholder-panel pack-translation-section">
      <div className="pack-translation-section-heading">
        <div><h2>{ko?"팩 기본 정보":"Pack information"}</h2>
          <p className="muted">{ko?"제목과 소개를 번역하세요.":"Translate the title and introduction."}</p></div>
      </div>
      {pair(ko?"팩 제목":"Pack title",source?.title,draft.title,
        next=>change({...draft,title:next}),false,180)}
      {pair(ko?"팩 설명":"Pack description",source?.description,draft.description,
        next=>change({...draft,description:next}),true,2000)}
    </section>

    <section className="placeholder-panel pack-translation-section">
      <div className="pack-translation-section-heading">
        <div><h2>{ko?"파트 제목 및 설명":"Chapters"}</h2>
          <p className="muted">{ko?"파트를 열어 원문과 번역을 비교하세요.":"Expand a chapter to compare its source and translation."}</p></div>
        <span className="pack-translation-count">{draft.sections.length}{ko?"개 파트":" chapters"}</span>
      </div>
      {draft.sections.length===0?<p className="muted">{ko?"원본에 파트가 없습니다.":"No chapters in the original."}</p>:
        <div className="pack-translation-entries">
          {draft.sections.map((part,i)=>{
            const original=source?.sections?.find(item=>item.start===part.start)??{start:part.start,title:"",description:""};
            return <Entry key={part.start} title={(ko?"파트 ":"Chapter ")+(i+1)+" · "+(original.title||"—")}
              status={sectionStatus(original,part)} initiallyOpen={i===0}>
              {pair(ko?"파트 제목":"Chapter title",original.title,part.title,
                next=>change({...draft,sections:draft.sections.map((v,j)=>j===i?{...v,title:next}:v)}),false,120)}
              {pair(ko?"파트 설명":"Chapter description",original.description,part.description,
                next=>change({...draft,sections:draft.sections.map((v,j)=>j===i?{...v,description:next}:v)}),true,500)}
            </Entry>;
          })}
        </div>}
    </section>

    <section className="placeholder-panel pack-translation-section">
      <h2>{ko?"마무리 문구":"Closing message"}</h2>
      {pair(ko?"마무리":"Ending",source?.closingMessage,draft.closingMessage,
        next=>change({...draft,closingMessage:next}),true,4000)}
    </section>

    <section className="placeholder-panel pack-translation-section">
      <div className="pack-translation-section-heading">
        <div><h2>{ko?"점수별 평가":"Score reviews"}</h2>
          <p className="muted">{ko?"점수 기준은 변경하지 않고 안내 문구만 번역합니다.":"Score thresholds remain fixed; only the wording changes."}</p></div>
        <span className="pack-translation-count">{draft.scoreReviews.length}{ko?"개 구간":" ranges"}</span>
      </div>
      <div className="pack-translation-entries">
        {draft.scoreReviews.map((band,i)=>{
          const original=source?.scoreReviews?.find(item=>item.minimumScore===band.minimumScore);
          const required=[original?.title,original?.description].filter(v=>Boolean(v?.trim())).length;
          const filled=[original?.title?.trim()?band.title:"",original?.description?.trim()?band.description:""].filter(v=>Boolean(v.trim())).length;
          return <Entry key={band.minimumScore}
            title={band.minimumScore+(ko?"점 이상":" points and above")}
            status={required===filled?(ko?"완료":"Complete"):(ko?"미완료":"Incomplete")}>
            {pair(ko?"평가 제목":"Review title",original?.title,band.title,
              next=>change({...draft,scoreReviews:draft.scoreReviews.map((v,j)=>j===i?{...v,title:next}:v)}),false,120)}
            {pair(ko?"평가 설명":"Review description",original?.description,band.description,
              next=>change({...draft,scoreReviews:draft.scoreReviews.map((v,j)=>j===i?{...v,description:next}:v)}),true,1500)}
          </Entry>;
        })}
        {draft.scoreReviews.length===0&&<p className="muted">{ko?"점수별 평가가 없습니다.":"No score reviews in the original."}</p>}
      </div>
    </section>
    <div className="pack-translation-save-bar">
      <div className="pack-translation-save-state" aria-live="polite">
        <strong>{busy?(ko?"저장 중…":"Saving…"):dirty?(ko?"저장되지 않은 변경사항":"Unsaved changes"):
          (ko?"변경사항 저장됨":"All changes saved")}</strong>
        <small>{missing>0?(ko?"팩 미번역 항목 "+missing+"개":"Missing pack fields: "+missing):
          !complete?(ko?"공개하려면 문제 번역도 완료해야 합니다.":"Question translations must be complete before publishing."):
          (ko?"번역 공개 조건을 확인했습니다.":"Ready for publication review.")}</small>
        {error&&<p role="alert" className="feedback">{error}</p>}
        {message&&<p role="status" className="feedback success">{message}</p>}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-outline" disabled={busy||!dirty}
          onClick={()=>void save("DRAFT")}>{ko?"초안 저장":"Save draft"}</button>
        <button type="button" className="btn btn-primary" disabled={busy||!complete||missing>0||!draft.title.trim()}
          onClick={()=>void save("PUBLISHED")}>{ko?"검토 후 공개":"Review & publish"}</button>
      </div>
    </div>
  </div>;
}
