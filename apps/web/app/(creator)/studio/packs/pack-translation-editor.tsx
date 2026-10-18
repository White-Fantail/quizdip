"use client";

import {useEffect,useState} from "react";
import {useLocale} from "../../../../src/i18n/provider";

type Part={start:number;title:string;description:string};
type Band={minimumScore:number;title:string;description:string};
type Language={locale:string;status:string;title:string;description:string;
  sections?:Part[];closingMessage?:string;scoreReviews?:Band[]};
type LanguageResult={sourceLocale:string;languages:Language[];coverage:{locale:string;complete:boolean}[]};
type Draft={title:string;description:string;sections:Part[];closingMessage:string;scoreReviews:Band[]};
async function request(path:string,method="GET",body?:object){
  const response=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.message||json.error||"Request failed");
  return json.data;
}
/** A pack language owns *text*; source chapter positions, media and score thresholds are immutable. */
export default function PackTranslationEditor({packId,sourceLocale}:{packId:string;sourceLocale:string}){
  const locale=useLocale(),ko=locale==="ko";
  const target=sourceLocale==="en"?"ko":sourceLocale==="ko"?"en":null;
  const [data,setData]=useState<LanguageResult|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [dirty,setDirty]=useState(false);

  useEffect(()=>{
    if(!target)return;
    let active=true;
    request("/packs/"+packId+"/languages").then((value:LanguageResult)=>{
      if(!active)return;
      setData(value);
      const source=value.languages.find(lang=>lang.locale===sourceLocale);
      const saved=value.languages.find(lang=>lang.locale===target);
      setDraft({
        title:saved?.title??"",
        description:saved?.description??"",
        sections:(source?.sections??[]).map(part=>{
          const translated=saved?.sections?.find(candidate=>candidate.start===part.start);
          return {start:part.start,title:translated?.title??"",description:translated?.description??""};
        }),
        closingMessage:saved?.closingMessage??"",
        scoreReviews:(source?.scoreReviews??[]).map(band=>{
          const translated=saved?.scoreReviews?.find(candidate=>candidate.minimumScore===band.minimumScore);
          return {minimumScore:band.minimumScore,title:translated?.title??"",description:translated?.description??""};
        })
      });
      setDirty(false);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});
    return ()=>{active=false;};
  },[packId,sourceLocale,target]);

  if(!target)return null;
  const source=data?.languages.find(lang=>lang.locale===sourceLocale);
  const saved=data?.languages.find(lang=>lang.locale===target);
  const complete=data?.coverage.find(entry=>entry.locale===target)?.complete;
  const change=(next:Draft)=>{setDraft(next);setDirty(true);setMessage("");};
  async function save(status:"DRAFT"|"PUBLISHED"){
    if(!draft||busy)return;
    if(status==="PUBLISHED"&&!window.confirm(ko?
      "번역된 제목, 전체 파트, 마무리 및 점수별 평가를 검토하고 공개할까요?":
      "Confirm that every translated chapter, ending and score band was reviewed?"))return;
    setBusy(true);setError("");setMessage("");
    try{
      await request("/packs/"+packId+"/languages/"+target,"PUT",{
        locale:target,...draft,status,confirm:status==="PUBLISHED"
      });
      const next=await request("/packs/"+packId+"/languages") as LanguageResult;
      setData(next);setDirty(false);
      setMessage(status==="PUBLISHED"?(ko?"번역본을 공개했습니다.":"Translation published.") :
        (ko?"번역 초안을 저장했습니다.":"Translation draft saved."));
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  return <section className="placeholder-panel">
    <h2>{ko?"퀴즈팩 번역 관리":"Pack language version"}</h2>
    <p className="muted">{ko?
      "원본의 문제 순서, 파트 이미지 및 점수 기준은 그대로 유지됩니다. 번역 제목·설명·마무리·점수별 평가는 언어별로 저장됩니다.":
      "The original question order, chapter images and score thresholds are shared. All text is stored by language."}
    </p>
    <p>{ko?"대상 언어":"Target language"}: <strong>{target==="ko"?"한국어":"English"}</strong>
      {" · "}{ko?"공개 상태":"Status"}: <strong>{saved?.status??"DRAFT"}</strong>
      {" · "}{ko?"문제 번역":"Question coverage"}: <strong>{complete?"100%":ko?"미완료":"Incomplete"}</strong></p>
    {error&&<p role="alert" className="feedback">{error}</p>}
    {message&&<p role="status" className="feedback success">{message}</p>}
    {!draft?<p>{ko?"언어팩을 불러오는 중…":"Loading translation…"}</p>:<div className="studio-form-grid">
      <label>{ko?"번역 제목":"Translated title"}
        <input maxLength={180} value={draft.title} onChange={e=>change({...draft,title:e.target.value})}/></label>
      <label>{ko?"번역 팩 설명":"Translated description"}
        <textarea rows={4} maxLength={2000} value={draft.description} onChange={e=>change({...draft,description:e.target.value})}/></label>
      <h3>{ko?"파트 제목 및 설명":"Chapter titles and descriptions"}</h3>
      {draft.sections.map((part,i)=><div className="studio-form-grid" key={part.start}>
        <p className="muted">{ko?"원문":"Source"} {i+1}: {source?.sections?.[i]?.title}
          {source?.sections?.[i]?.description&&<> — {source?.sections?.[i]?.description}</>}</p>
        <label>{ko?"번역 파트 제목":"Translated chapter title"}
          <input maxLength={120} value={part.title} onChange={e=>change({...draft,
            sections:draft.sections.map((v,j)=>j===i?{...v,title:e.target.value}:v)})}/></label>
        <label>{ko?"번역 파트 설명":"Translated chapter description"}
          <textarea rows={2} maxLength={500} value={part.description} onChange={e=>change({...draft,
            sections:draft.sections.map((v,j)=>j===i?{...v,description:e.target.value}:v)})}/></label>
      </div>)}
      <h3>{ko?"마무리 문구":"Closing message"}</h3>
      <p className="muted" style={{whiteSpace:"pre-wrap"}}>{source?.closingMessage}</p>
      <textarea rows={5} maxLength={4000} value={draft.closingMessage}
        onChange={e=>change({...draft,closingMessage:e.target.value})}/>
      <h3>{ko?"점수별 평가":"Score reviews"}</h3>
      {draft.scoreReviews.map((band,i)=><div key={band.minimumScore} className="studio-form-grid">
        <p className="muted">{band.minimumScore} {ko?"점 이상":"points and above"} · {source?.scoreReviews?.[i]?.title}</p>
        <label>{ko?"평가 제목":"Review title"}<input maxLength={120} value={band.title}
          onChange={e=>change({...draft,scoreReviews:draft.scoreReviews.map((v,j)=>j===i?{...v,title:e.target.value}:v)})}/></label>
        <label>{ko?"평가 설명":"Review description"}<textarea maxLength={1500} rows={2} value={band.description}
          onChange={e=>change({...draft,scoreReviews:draft.scoreReviews.map((v,j)=>j===i?{...v,description:e.target.value}:v)})}/></label>
      </div>)}
      <div className="actions">
        <button type="button" className="btn btn-outline" disabled={busy||!dirty} onClick={()=>void save("DRAFT")}>
          {ko?"번역 초안 저장":"Save draft"}</button>
        <button type="button" className="btn btn-primary" disabled={busy||!complete||!draft.title.trim()}
          onClick={()=>void save("PUBLISHED")}>{ko?"검토 후 번역 공개":"Review and publish"}</button>
      </div>
    </div>}
  </section>;
}
