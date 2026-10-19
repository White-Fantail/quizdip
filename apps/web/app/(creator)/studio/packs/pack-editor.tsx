"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useLocale} from "../../../../src/i18n/provider";
import {localizeHref} from "../../../../src/i18n/core";
import MediaPicker from "../quizzes/quiz-media-picker";
import PackRecommendationEditor from "./pack-recommendation-editor";
type PackSection={start:number;title:string;description:string;mediaId?:string|null};
type ScoreReview={minimumScore:number;title:string;description:string};

type Pack={id:string;title:string;description:string;coverMediaId?:string|null;sections?:PackSection[];closingMessage?:string;scoreReviews?:ScoreReview[];publication:string;sourceLocale:string;orderMode:"CREATOR"|"RANDOM";
  kidsReviewStatus:string;kidsEligible:boolean;kidsReady:boolean;kidsIssue:string;excludedCount:number;
  quizIds:string[];members:{id:string;title:string}[]};
type Quiz={id:string;title:string;publication:string};
type QuizPage={items:Quiz[];total:number};
type Preview={ready:boolean;issues:string[];draftCount:number;questionCount:number};
type Insights={runs:number;completed:number;averageSolved:number|null;ratings:{positive:number;negative:number};reportCounts:{reason:string;count:number}[]};
const PAGE_SIZE=20;
function ChapterImagePreview({mediaId,ko}:{mediaId:string;ko:boolean}){
  const [src,setSrc]=useState("");
  useEffect(()=>{
    let active=true;
    void fetch("/api/v1/media/"+encodeURIComponent(mediaId)+"?purpose=thumbnail",{credentials:"same-origin"})
      .then(response=>response.ok?response.json():null)
      .then(body=>{if(active)setSrc(body?.data?.thumbnailUrl||"");})
      .catch(()=>{if(active)setSrc("");});
    return ()=>{active=false;};
  },[mediaId]);
  return src?<img src={src} alt={ko?"파트 이미지 미리보기":"Chapter image preview"}
    style={{width:180,maxHeight:130,objectFit:"contain",borderRadius:12}}/>:
    <p className="muted">{ko?"선택한 이미지":"Image selected"}: {mediaId}</p>;
}
async function api(path:string,method="GET",body?:object){
  const response=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
  const json=await response.json();
  if(!response.ok)throw Error(json.message||json.error||"Request failed");
  return json.data;
}
export default function PackEditor({packId,detailHref}:{packId?:string;detailHref?:string}){
  const router=useRouter(),locale=useLocale(),ko=locale==="ko";
  const destination=detailHref??localizeHref(packId?"/studio/packs/"+packId:"/studio/packs",locale);
  const [loading,setLoading]=useState(!!packId);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [title,setTitle]=useState(""),[description,setDescription]=useState("");
  const [coverMediaId,setCoverMediaId]=useState<string|null>(null);
  const [coverPreview,setCoverPreview]=useState("");
  const [coverPicker,setCoverPicker]=useState(false);
  const [sections,setSections]=useState<PackSection[]>([]);
  const [chapterPicker,setChapterPicker]=useState<number|null>(null);
  const [closingMessage,setClosingMessage]=useState("");
  const [scoreReviews,setScoreReviews]=useState<ScoreReview[]>([]);
  const [language,setLanguage]=useState<"en"|"ko">(locale);
  const [orderMode,setOrderMode]=useState<"CREATOR"|"RANDOM">("CREATOR");
  const [members,setMembers]=useState<string[]>([]);
  const [memberTitles,setMemberTitles]=useState<Record<string,string>>({});
  const [publication,setPublication]=useState("DRAFT");
  const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
  const [query,setQuery]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(0);
  const [questions,setQuestions]=useState<Quiz[]>([]),[questionTotal,setQuestionTotal]=useState(0);
  const [questionLoading,setQuestionLoading]=useState(true),[questionError,setQuestionError]=useState("");
  useEffect(()=>{
    if(!packId)return;
    let active=true;
    setLoading(true);
    void api("/me/packs/"+encodeURIComponent(packId))
      .then((pack:Pack)=>{
        if(!active)return;
        setTitle(pack.title);setDescription(pack.description||"");setMembers(pack.quizIds);
        setCoverMediaId(pack.coverMediaId??null);setSections(pack.sections??[]);
        setClosingMessage(pack.closingMessage??"");setScoreReviews(pack.scoreReviews??[]);
        setOrderMode(pack.orderMode||"CREATOR");setPublication(pack.publication);
        setMemberTitles(Object.fromEntries(pack.members.map(member=>[member.id,member.title])));
        setLanguage(pack.sourceLocale==="ko"?"ko":"en");
        setDirty(false);
      }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[packId]);
  useEffect(()=>{
    let active=true;
    if(!coverMediaId){setCoverPreview("");return;}
    void api("/media/"+encodeURIComponent(coverMediaId)+"?purpose=thumbnail")
      .then(data=>{if(active)setCoverPreview(data.thumbnailUrl||"");})
      .catch(()=>{if(active)setCoverPreview("");});
    return ()=>{active=false;};
  },[coverMediaId]);
  useEffect(()=>{
    const timer=setTimeout(()=>setSearch(query.trim()),300);
    return ()=>clearTimeout(timer);
  },[query]);
  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({limit:String(PAGE_SIZE),offset:String(page*PAGE_SIZE),
      publication:"all",safety:"all",sort:"newest",search});
    setQuestionLoading(true);setQuestionError("");
    void fetch("/api/v1/me/quizzes?"+params.toString(),{
      credentials:"same-origin",cache:"no-store",signal:controller.signal
    }).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw Error(data.message||data.error||"Could not load questions");
      return data.data as QuizPage;
    }).then(result=>{
      if(!controller.signal.aborted){setQuestions(result.items||[]);setQuestionTotal(result.total||0);}
    }).catch(e=>{
      if(!controller.signal.aborted)setQuestionError(e instanceof Error?e.message:String(e));
    }).finally(()=>{if(!controller.signal.aborted)setQuestionLoading(false);});
    return ()=>controller.abort();
  },[page,search]);
  function change(){setDirty(true);setNotice("");}
  function changeMembers(ids:string[]){setMembers(ids);change();}
  async function save(){
    if(busy)return;
    if(!title.trim()||!members.length){setError(ko?"제목과 최소 한 문제를 선택하세요.":"Choose a title and at least one question.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      const body={title:title.trim(),description,coverMediaId,sections,closingMessage,scoreReviews,quizIds:members,orderMode};
      if(packId){
        await api("/packs/"+encodeURIComponent(packId),"PATCH",body);
        setDirty(false);
        router.replace(destination);
        router.refresh();
      }else{
        const pack=await api("/packs","POST",{...body,locale:language});
        setDirty(false);
        router.replace(localizeHref("/studio/packs/"+pack.id,locale));
        router.refresh();
      }
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  if(loading)return <div className="studio-empty" role="status">{ko?"팩을 불러오는 중…":"Loading pack…"}</div>;
  if(packId&&error&&!title)return <div className="studio-empty" role="alert">{error}</div>;
  const pages=Math.max(1,Math.ceil(questionTotal/PAGE_SIZE));
  return <section className="studio-workspace pack-editor">
    {packId&&<div className="studio-chip-row"><span className={"media-state-chip "+(publication==="PUBLISHED"?"media-ok":"media-wait")}>
      {publication==="PUBLISHED"?(ko?"공개 중":"Published"):publication==="HIDDEN"?(ko?"숨김":"Hidden"):(ko?"초안":"Draft")}
    </span></div>}
    <div className="studio-filters pack-form-fields">
      <label>{ko?"제목":"Title"}
        <input value={title} maxLength={180} onChange={e=>{setTitle(e.target.value);change();}}/>
      </label>
      {!packId&&<label>{ko?"원본 언어":"Original language"}
        <select value={language} onChange={e=>{setLanguage(e.target.value as "en"|"ko");change();}}>
          <option value="en">English</option><option value="ko">한국어</option>
        </select>
      </label>}
      <label className="pack-description">{ko?"설명":"Description"}
        <textarea rows={3} value={description} maxLength={2000} onChange={e=>{setDescription(e.target.value);change();}}/>
      </label>
      <label>{ko?"문제 출제 순서":"Question order"}
        <select value={orderMode} onChange={e=>{setOrderMode(e.target.value as "CREATOR"|"RANDOM");change();}}>
          <option value="CREATOR">{ko?"등록한 순서대로":"Creator-defined order"}</option>
          <option value="RANDOM" disabled={sections.length>0}>{ko?"플레이마다 랜덤으로":"Random each play"}</option>
        </select>
      </label>
    </div>
    <p className="muted">{orderMode==="RANDOM"
      ?(ko?"새 플레이 시작 시 순서를 한 번 섞고, 이어 하기에서는 그 순서를 유지합니다.":"Shuffle once per run; resuming retains the same order.")
      :(ko?"아래에서 정한 순서대로 출제합니다.":"Questions appear in the order below.")}</p>
    <section className="feature-card">
      <h2>{ko?"대표 이미지 · 선택":"Cover image · optional"}</h2>
      <p className="muted">{ko?"퀴즈팩 상세 화면에 표시할 사진을 내 미디어 라이브러리에서 고르세요. 공개 시 승인된 이미지만 표시됩니다.":"Choose an image from your library for the public pack description. Publishing requires an approved image."}</p>
      {coverMediaId&&<div className="actions">{coverPreview&&<img src={coverPreview} alt={ko?"선택한 대표 이미지":"Selected cover"} style={{width:180,maxHeight:140,objectFit:"contain",borderRadius:12}}/>}
        <span className="muted">{coverMediaId}</span>
        <button type="button" className="btn btn-outline" onClick={()=>{setCoverMediaId(null);change();}}>{ko?"이미지 제거":"Remove cover"}</button>
      </div>}
      <button type="button" className="btn btn-outline" onClick={()=>setCoverPicker(v=>!v)}>{coverPicker?(ko?"이미지 선택 닫기":"Close picker"):(ko?"이미지 선택":"Select image")}</button>
      {coverPicker&&<MediaPicker kind="image" selectedId={coverMediaId??""}
        onSelect={id=>{setCoverMediaId(id);setCoverPicker(false);change();}}
        onClose={()=>setCoverPicker(false)}/>}
    </section>
    <section className="feature-card">
      <h2>{ko?"파트 구성 · 선택":"Chapters · optional"}</h2>
      <p className="muted">{ko?"파트 제목은 해당 문제에서 자동으로 표시됩니다. 첫 번째 파트는 1번 문제부터 시작하고 문제 순서는 고정됩니다.":"Chapter headings appear automatically at the specified question; the first chapter starts at question 1, with creator-defined order."}</p>
      {sections.map((section,index)=><div className="studio-form-grid" key={index} style={{marginBottom:16}}>
        <label>{ko?"시작 문제":"Starts at question"}
          <input type="number" min={1} max={members.length} value={section.start}
            onChange={e=>{const at=Number(e.target.value);setSections(old=>old.map((s,i)=>i===index?{...s,start:at}:s));change();}}/>
        </label>
        <label>{ko?"파트 제목":"Chapter heading"}
          <input maxLength={120} value={section.title} onChange={e=>{setSections(old=>old.map((s,i)=>i===index?{...s,title:e.target.value}:s));change();}}/>
        </label>
        <label className="studio-wide">{ko?"파트 설명 · 선택":"Chapter description · optional"}
          <textarea rows={2} maxLength={500} value={section.description}
            onChange={e=>{setSections(old=>old.map((s,i)=>i===index?{...s,description:e.target.value}:s));change();}}/>
        </label>
        <div className="studio-wide">
          <p className="muted">{ko?"파트 소개 이미지 · 선택":"Chapter image · optional"}</p>
          {section.mediaId&&<ChapterImagePreview mediaId={section.mediaId} ko={ko}/>}
          <div className="actions">
            <button type="button" className="btn btn-outline" onClick={()=>setChapterPicker(chapterPicker===index?null:index)}>
              {chapterPicker===index?(ko?"선택 닫기":"Close picker"):(ko?"파트 이미지 선택":"Choose chapter image")}
            </button>
            {section.mediaId&&<button type="button" className="btn btn-outline" onClick={()=>{
              setSections(old=>old.map((part,i)=>i===index?{...part,mediaId:null}:part));change();
            }}>{ko?"이미지 제거":"Remove image"}</button>}
          </div>
          {chapterPicker===index&&<MediaPicker kind="image" selectedId={section.mediaId??""}
            onSelect={id=>{setSections(old=>old.map((part,i)=>i===index?{...part,mediaId:id}:part));setChapterPicker(null);change();}}
            onClose={()=>setChapterPicker(null)}/>}
        </div>
        <button type="button" className="btn btn-outline" onClick={()=>{setSections(old=>old.filter((_,i)=>i!==index));setChapterPicker(null);change();}}>{ko?"파트 제거":"Remove chapter"}</button>
      </div>)}
      <button className="btn btn-outline" type="button" disabled={!members.length||sections.length>=members.length||sections.length>=30}
        onClick={()=>{
          const start=sections.length?sections[sections.length-1].start+1:1;
          if(start<=members.length){setSections(old=>[...old,{start,title:"",description:""}]);setOrderMode("CREATOR");change();}
        }}>+ {ko?"파트 추가":"Add chapter"}</button>
    </section>
    <section className="feature-card">
      <h2>{ko?"퀴즈팩 마무리 · 선택":"Pack ending · optional"}</h2>
      <p className="muted">{ko?"전체 문제를 마친 뒤 결과와 함께 보여줄 제작자의 글입니다.":"Your final note is shown alongside the results after all questions."}</p>
      <label>{ko?"마무리 문구 / 종합 설명":"Closing message / overview"}
        <textarea rows={5} maxLength={4000} value={closingMessage}
          onChange={e=>{setClosingMessage(e.target.value);change();}}
          placeholder={ko?"오늘의 퀴즈를 마치며…":"Now that you've finished…"} />
      </label>
      <h3>{ko?"점수에 따른 평가 · 선택":"Score commentary · optional"}</h3>
      <p className="muted">{ko?"최소 총점을 기준으로 가장 높은 구간의 평가 한 개를 보여줍니다. 예: 0점, 200점, 400점. 점수가 높아지는 순서로 입력하세요.":"Set increasing minimum total points (such as 0, 200, 400). The highest qualifying commentary will appear."}</p>
      {scoreReviews.map((band,index)=><div key={index} className="studio-form-grid" style={{marginBottom:16}}>
        <label>{ko?"최소 총점":"Minimum total points"}
          <input type="number" min={0} max={10000} value={band.minimumScore}
            onChange={e=>{setScoreReviews(old=>old.map((v,i)=>i===index?{...v,minimumScore:Number(e.target.value)}:v));change();}}/>
        </label>
        <label>{ko?"평가 제목":"Rating title"}
          <input maxLength={120} value={band.title}
            onChange={e=>{setScoreReviews(old=>old.map((v,i)=>i===index?{...v,title:e.target.value}:v));change();}}/>
        </label>
        <label className="studio-wide">{ko?"평가 내용":"Rating message"}
          <textarea rows={3} maxLength={1500} value={band.description}
            onChange={e=>{setScoreReviews(old=>old.map((v,i)=>i===index?{...v,description:e.target.value}:v));change();}}/>
        </label>
        <button type="button" className="btn btn-outline" onClick={()=>{setScoreReviews(old=>old.filter((_,i)=>i!==index));change();}}>{ko?"구간 삭제":"Remove score band"}</button>
      </div>)}
      <button type="button" className="btn btn-outline" disabled={scoreReviews.length>=20}
        onClick={()=>{setScoreReviews(old=>[...old,{minimumScore:old.length?old[old.length-1].minimumScore+100:0,title:"",description:""}]);change();}}>
        + {ko?"점수 평가 추가":"Add score commentary"}
      </button>
    </section>
    {packId&&<PackRecommendationEditor packId={packId} locale={language}/>}
    <div className="pack-editor-columns">
      <section className="feature-card">
        <h2>{ko?"팩에 포함된 문제":"Questions in this pack"} ({members.length}/100)</h2>
        {!members.length&&<p className="muted">{ko?"오른쪽 목록에서 문제를 추가하세요.":"Add questions from the available list."}</p>}
        <div className="pack-question-list">
          {members.map((id,index)=><div className="pack-question" key={id}>
            <span className="pack-question-title">{index+1}. {memberTitles[id]||id}</span>
            <div className="pack-question-actions">
              <button type="button" disabled={index===0||busy} aria-label={ko?"위로 이동":"Move up"} onClick={()=>{
                const next=[...members];[next[index-1],next[index]]=[next[index],next[index-1]];changeMembers(next);
              }}>↑</button>
              <button type="button" disabled={index===members.length-1||busy} aria-label={ko?"아래로 이동":"Move down"} onClick={()=>{
                const next=[...members];[next[index+1],next[index]]=[next[index],next[index+1]];changeMembers(next);
              }}>↓</button>
              <button type="button" disabled={busy} aria-label={ko?"문제 제거":"Remove question"} onClick={()=>changeMembers(members.filter(x=>x!==id))}>×</button>
            </div>
          </div>)}
        </div>
      </section>
      <section className="feature-card">
        <h2>{ko?"내 문제에서 추가":"Add from my questions"}</h2>
        <label className="pack-question-search">{ko?"문제 검색":"Search questions"}
          <input type="search" maxLength={120} value={query} placeholder={ko?"문제 제목 검색":"Search titles"} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
        </label>
        {questionError&&<p role="alert">{questionError}</p>}
        {questionLoading&&<p role="status" className="muted">{ko?"불러오는 중…":"Loading…"}</p>}
        {!questionLoading&&!questionError&&<div className="pack-question-list">
          {questions.filter(q=>!members.includes(q.id)).map(q=><button className="pack-add-question" type="button" key={q.id}
            disabled={members.length>=100||busy} onClick={()=>{
              setMemberTitles(old=>({...old,[q.id]:q.title}));changeMembers([...members,q.id]);
            }}><span>+ {q.title}</span><small>{q.publication==="PUBLISHED"?(ko?"공개":"Published"):(ko?"초안":"Draft")}</small></button>)}
          {!questions.length&&<p className="muted">{ko?"검색 결과가 없어요.":"No matching questions."}</p>}
        </div>}
        {!questionLoading&&!questionError&&questionTotal>PAGE_SIZE&&<nav className="media-pagination" aria-label={ko?"문제 검색 페이지":"Question pages"}>
          <button type="button" className="btn btn-outline" disabled={page===0} onClick={()=>setPage(n=>n-1)}>{ko?"이전":"Previous"}</button>
          <span>{page+1} / {pages}</span>
          <button type="button" className="btn btn-outline" disabled={page+1>=pages} onClick={()=>setPage(n=>n+1)}>{ko?"다음":"Next"}</button>
        </nav>}
      </section>
    </div>
    <div className="pack-editor-footer">
      <div className="actions">
        <Link href={destination} className="btn btn-outline"
          onClick={e=>{if(dirty&&!window.confirm(ko?"수정 사항을 버리고 이동할까요?":"Discard unsaved changes?"))e.preventDefault();}}>
          {ko?"취소":"Cancel"}</Link>
        <button type="button" className="btn btn-primary" disabled={busy||(!!packId&&!dirty)} onClick={()=>void save()}>
          {busy?(ko?"저장 중…":"Saving…"):packId?(ko?"변경사항 저장":"Save changes"):(ko?"팩 만들기":"Create pack")}</button>
      </div>
      {!packId&&<p className="muted">{ko?"팩을 만든 다음 상세 페이지에서 공개 여부와 어린이용 심사를 관리하세요.":"Create the pack, then manage publication and Kids review from its detail page."}</p>}
      {error&&<p role="alert">{error}</p>}
      {notice&&<p role="status">{notice}</p>}
    </div>
  </section>;
}
