"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useLocale} from "../../../../src/i18n/provider";
import {localizeHref} from "../../../../src/i18n/core";
import PackTranslationEditor from "./pack-translation-editor";

type Member={id:string;title:string;publication?:string;safetyStatus?:string;ownedByCreator?:boolean};
type Pack={id:string;title:string;description:string;publication:string;sourceLocale:string;
  currentVersion?:number;orderMode:"CREATOR"|"RANDOM";safetyStatus:string;
  kidsReviewStatus:string;kidsEligible:boolean;kidsReady:boolean;kidsIssue:string;
  excludedCount:number;quizIds:string[];members:Member[]};
type Insights={runs:number;completed:number;averageSolved:number|null;
  ratings:{positive:number;negative:number};reportCounts:{reason:string;count:number}[]};
type Preview={ready:boolean;issues:string[];draftCount:number;questionCount:number};

async function api(path:string,method="GET",body?:object):Promise<any>{
  const response=await fetch("/api/v1"+path,{method,credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:undefined,
    body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.message||json.error||"Request failed");
  return json.data;
}
export default function PackDetail({packId,backHref,editHref}:{packId:string;backHref:string;editHref:string}){
  const locale=useLocale(),ko=locale==="ko";
  const [pack,setPack]=useState<Pack|null>(null);
  const [insights,setInsights]=useState<Insights|null>(null);
  const [insightsError,setInsightsError]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");setInsightsError("");
    void api("/me/packs/"+encodeURIComponent(packId))
      .then((data:Pack)=>{if(active)setPack(data);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setLoading(false);});
    void api("/me/packs/"+encodeURIComponent(packId)+"/insights?locale=all")
      .then((data:Insights)=>{if(active)setInsights(data);})
      .catch(e=>{if(active)setInsightsError(e instanceof Error?e.message:String(e));});
    return ()=>{active=false;};
  },[packId,refresh]);

  async function perform(action:()=>Promise<string>){
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{setNotice(await action());setRefresh(n=>n+1);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function checkReadiness(){
    if(busy)return;
    setBusy(true);setError("");setNotice("");setPreview(null);
    try{setPreview(await api("/packs/"+encodeURIComponent(packId)+"/publish-preview") as Preview);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function publish(){
    if(!pack||busy||!preview?.ready||pack.publication==="PUBLISHED")return;
    if(!window.confirm(ko?"팩과 포함된 내 초안 문제를 함께 공개할까요?":"Publish this pack and included drafts you own?"))return;
    await perform(async()=>{
      await api("/packs/"+encodeURIComponent(packId)+"/publish","POST",{confirm:true});
      setPreview(null);
      return ko?"팩을 공개했습니다.":"Pack published.";
    });
  }
  async function requestKids(){
    if(!pack||busy||!pack.kidsReady||pack.kidsReviewStatus==="APPROVED"||pack.kidsReviewStatus==="PENDING")return;
    if(!window.confirm(ko?"어린이용 퀴즈팩 심사를 신청할까요?":"Request Kids review for this pack?"))return;
    await perform(async()=>{
      await api("/packs/"+encodeURIComponent(packId)+"/kids-request","POST",{confirm:true});
      return ko?"어린이용 심사를 신청했습니다.":"Kids review requested.";
    });
  }

  const status=(value:string)=>value==="PUBLISHED"?(ko?"공개":"Published"):
    value==="HIDDEN"?(ko?"숨김":"Hidden"):value==="DRAFT"?(ko?"초안":"Draft"):
    value==="RESTRICTED"?(ko?"제한":"Restricted"):value;
  if(loading&&!pack)return <div className="studio-empty" role="status">{ko?"팩 정보를 불러오는 중…":"Loading pack details…"}</div>;
  if(!pack)return <div className="studio-empty" role="alert">
    <h2>{ko?"팩을 열 수 없습니다":"Pack unavailable"}</h2>
    <p>{error|| (ko?"팩을 찾을 수 없거나 접근 권한이 없습니다.":"Pack not found or access denied.")}</p>
    <div className="actions">
      <button className="btn btn-outline" type="button" onClick={()=>setRefresh(n=>n+1)}>{ko?"다시 시도":"Retry"}</button>
      <Link className="btn btn-outline" href={backHref}>{ko?"팩 목록":"All packs"}</Link>
    </div>
  </div>;

  const sourceLocale=pack.sourceLocale==="ko"?"한국어":pack.sourceLocale==="en"?"English":(ko?"미분류":"Unclassified");
  const kidsStatus=pack.kidsEligible&&pack.kidsReviewStatus==="APPROVED"?(ko?"어린이용 승인":"Kids approved"):
    pack.kidsReviewStatus==="PENDING"?(ko?"Kids 심사 대기":"Kids review pending"):
    pack.kidsReviewStatus==="REJECTED"?(ko?"Kids 신청 거절":"Kids review rejected"):
    (ko?"Kids 미신청":"Kids not requested");
  const publicLink=pack.publication==="PUBLISHED"&&pack.safetyStatus!=="RESTRICTED"&&
    (pack.sourceLocale==="ko"||pack.sourceLocale==="en")&&pack.excludedCount<pack.members.length;
  return <div className="studio-detail-workspace pack-view">
    <div className="studio-detail-head">
      <div>
        <h1>{pack.title}</h1>
        <p className="muted">{pack.description|| (ko?"설명이 아직 없습니다.":"No description provided.")}</p>
        <div className="studio-chip-row">
          <span className={"media-state-chip "+(pack.publication==="PUBLISHED"?"media-ok":"media-wait")}>{status(pack.publication)}</span>
          <span className={"media-state-chip "+(pack.safetyStatus==="RESTRICTED"?"media-blocked":"media-ok")}>
            {pack.safetyStatus==="RESTRICTED"?(ko?"노출 제한":"Restricted"):(ko?"정상":"Active")}</span>
          <span className={"media-state-chip "+(pack.kidsEligible?"media-ok":"media-wait")}>{kidsStatus}</span>
        </div>
      </div>
      <div className="actions">
        <Link className="btn btn-primary" href={editHref}>{ko?"팩 편집":"Edit pack"}</Link>
        {publicLink&&<Link className="btn btn-outline" href={localizeHref("/packs/"+pack.id,pack.sourceLocale as "en"|"ko")}>
          {ko?"공개 팩 보기":"View published pack"}</Link>}
      </div>
    </div>
    {error&&<p role="alert" className="feedback">{error}</p>}
    {notice&&<p role="status" className="feedback success">{notice}</p>}

    <section className="placeholder-panel">
      <h2>{ko?"팩 정보":"Pack information"}</h2>
      <div className="pack-view-metadata">
        <div><small>{ko?"포함된 문제":"Questions"}</small><strong>{pack.members.length}</strong></div>
        <div><small>{ko?"출제 순서":"Play order"}</small><strong>{pack.orderMode==="RANDOM"?(ko?"랜덤":"Random"):(ko?"등록 순서":"Creator order")}</strong></div>
        <div><small>{ko?"원본 언어":"Original language"}</small><strong>{sourceLocale}</strong></div>
        {pack.currentVersion&&<div><small>{ko?"팩 버전":"Version"}</small><strong>v{pack.currentVersion}</strong></div>}
      </div>
      <p className="muted">{pack.orderMode==="RANDOM"?
        (ko?"새 플레이마다 문제 순서를 섞고, 이어 할 때는 정해진 순서를 유지합니다.":"Questions are shuffled once per new run; resuming keeps the same order."):
        (ko?"제작자가 정한 순서대로 문제가 출제됩니다.":"Questions play in the creator-defined order.")}</p>
      {pack.publication==="PUBLISHED"&&pack.excludedCount>0&&<p role="status" className="feedback">
        {ko?("현재 "+pack.excludedCount+"개 문제가 일반 플레이에서 임시 제외됩니다. 팩 구성에는 남아 있고, 복구되면 자동으로 포함됩니다."):
          (pack.excludedCount+" question(s) are temporarily excluded from General play; they remain in the pack.")}
      </p>}
    </section>

    {["en","ko"].includes(pack.sourceLocale)&&<PackTranslationEditor packId={pack.id} sourceLocale={pack.sourceLocale}/>}

    <section className="placeholder-panel">
      <div className="studio-section-head">
        <div><h2>{ko?"포함된 문제":"Included questions"}</h2>
          <p className="muted">{ko?"저장된 구성 순서입니다. 각 문제를 눌러 내용을 확인하세요.":"Saved composition order. Open a question to see its details."}</p></div>
        <strong>{pack.members.length}{ko?"개":" questions"}</strong>
      </div>
      {pack.members.length?<ol className="pack-view-members">
        {pack.members.map((member,index)=><li key={member.id}>
          <span className="pack-view-number">{index+1}</span>
          <div className="pack-view-member-body">
            <strong>{member.title}</strong>
            <div className="studio-chip-row">
              {member.publication&&<span className="media-state-chip media-wait">{status(member.publication)}</span>}
              {member.safetyStatus==="RESTRICTED"&&<span className="media-state-chip media-blocked">{ko?"문제 제한":"Quiz restricted"}</span>}
            </div>
          </div>
          {(member.ownedByCreator!==false||member.publication==="PUBLISHED")&&
            <Link className="btn btn-outline" href={localizeHref(
              member.ownedByCreator===false?"/play/"+member.id:"/studio/quizzes/"+member.id,locale)}>
              {ko?"문제 보기 →":"View quiz →"}</Link>}
        </li>)}
      </ol>:<p className="muted">{ko?"포함된 문제가 없습니다. 편집에서 문제를 추가하세요.":"There are no questions. Add them on the edit page."}</p>}
    </section>

    <section className="placeholder-panel">
      <h2>{ko?"공개 관리":"Publication"}</h2>
      {pack.publication==="PUBLISHED"?<p className="muted">{ko?"현재 이 팩은 공개 상태입니다. Kids 앱 노출은 별도 승인이 필요합니다.":"This pack is published. Kids visibility requires separate approval."}</p>:
        <><p className="muted">{ko?"검증 후 전체 공개할 수 있습니다. 포함된 제작자 소유 초안도 함께 공개됩니다.":"Check readiness before publishing. Included drafts you own are published together."}</p>
          <div className="actions">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void checkReadiness()}>{ko?"공개 전 검증":"Check readiness"}</button>
            <button type="button" className="btn btn-primary" disabled={busy||!preview?.ready||pack.safetyStatus==="RESTRICTED"} onClick={()=>void publish()}>{ko?"전체 공개":"Publish pack"}</button>
          </div>
          {preview&&<div className="pack-view-preflight" role="status">
            <h3>{preview.ready?(ko?"공개 준비 완료":"Ready to publish"):(ko?"확인이 필요합니다":"Needs attention")}</h3>
            <p>{preview.questionCount} {ko?"문제":"questions"} · {preview.draftCount} {ko?"초안":"drafts"}</p>
            {preview.issues.map(issue=><p key={issue}>{issue}</p>)}
          </div>}
        </>}
      {pack.safetyStatus==="RESTRICTED"&&<p className="feedback" role="alert">{ko?"관리자가 제한한 팩은 검토 후 공개할 수 있습니다.":"A restricted pack needs moderator clearance before publication."}</p>}
    </section>

    <section className="placeholder-panel">
      <h2>{ko?"어린이용 노출":"Kids app visibility"}</h2>
      <p><strong>{kidsStatus}</strong></p>
      <p className="muted">{ko?"모든 구성 문제가 어린이용으로 승인되어야 팩 심사를 신청할 수 있습니다. 일반 공개와 어린이용 승인은 별개입니다.":
        "Every included quiz must be Kids-approved before pack review can be requested. Publishing to General does not grant Kids access."}</p>
      {!pack.kidsReady&&pack.kidsIssue&&pack.publication==="PUBLISHED"&&
        <p className="muted">{ko?"신청 조건 미충족: ":"Not ready to apply: "}{pack.kidsIssue}</p>}
      {pack.publication==="PUBLISHED"&&<button type="button" className="btn btn-outline"
        disabled={busy||!pack.kidsReady||pack.safetyStatus==="RESTRICTED"||pack.kidsReviewStatus==="PENDING"||pack.kidsReviewStatus==="APPROVED"}
        onClick={()=>void requestKids()}>{ko?"어린이용 심사 신청":"Request Kids review"}</button>}
    </section>

    <section className="placeholder-panel">
      <h2>{ko?"팩 플레이 결과와 평가":"Play results and feedback"}</h2>
      {insightsError&&<p role="alert">{insightsError}</p>}
      {!insights&&!insightsError&&<p role="status">{ko?"통계를 불러오는 중…":"Loading insights…"}</p>}
      {insights&&<>
        <div className="pack-view-metadata">
          <div><small>{ko?"플레이 시작":"Starts"}</small><strong>{insights.runs.toLocaleString()}</strong></div>
          <div><small>{ko?"완료":"Completed"}</small><strong>{insights.completed.toLocaleString()}</strong></div>
          <div><small>{ko?"좋아요":"Likes"}</small><strong>{insights.ratings.positive.toLocaleString()}</strong></div>
          <div><small>{ko?"아쉬워요":"Needs work"}</small><strong>{insights.ratings.negative.toLocaleString()}</strong></div>
        </div>
        {insights.averageSolved!==null&&<p className="muted">{ko?"완료한 플레이의 평균 정답 수":"Average correct in completed runs"}: {insights.averageSolved.toFixed(1)}</p>}
        {insights.reportCounts.length>0&&<p className="muted">{ko?"신고 집계":"Reports"}: {insights.reportCounts.map(r=>r.reason+" "+r.count).join(", ")}</p>}
        <p className="muted">{ko?"개별 플레이어나 신고자의 신원은 공개되지 않습니다.":"Individual players and reporters are not identified."}</p>
      </>}
    </section>
  </div>;
}
