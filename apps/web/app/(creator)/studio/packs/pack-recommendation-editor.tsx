"use client";
import {useEffect,useState} from "react";
type Item={id:string;title:string};
export default function PackRecommendationEditor({packId,locale}:{packId:string;locale:"en"|"ko"}){
  const ko=locale==="ko";
  const [ids,setIds]=useState<string[]>([]),[saved,setSaved]=useState<string[]>([]);
  const [titles,setTitles]=useState<Record<string,string>>({});
  const [choices,setChoices]=useState<Item[]>([]);
  const [query,setQuery]=useState(""),[search,setSearch]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  useEffect(()=>{
    let active=true;
    void fetch("/api/v1/me/packs/"+packId,{credentials:"same-origin"}).then(async r=>{
      if(!r.ok)throw Error("Could not load recommendations");return (await r.json()).data;
    }).then(data=>{if(!active)return;
      const selected=Array.isArray(data.recommendedPackIds)?data.recommendedPackIds as string[]:[];
      setIds(selected);setSaved(selected);
      setTitles(Object.fromEntries(((data.recommendedPacks??[]) as Item[]).map(item=>[item.id,item.title])));
    }).catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;};
  },[packId]);
  useEffect(()=>{const t=setTimeout(()=>setSearch(query.trim()),250);return ()=>clearTimeout(t);},[query]);
  useEffect(()=>{
    const controller=new AbortController();
    const qs=new URLSearchParams({locale,limit:"20",search});
    void fetch("/api/v1/packs?"+qs,{credentials:"same-origin",signal:controller.signal,cache:"no-store"})
      .then(async r=>{if(!r.ok)throw Error("Search unavailable");return (await r.json()).data;})
      .then(data=>{if(controller.signal.aborted)return;const list=(data.items??[]) as Item[];setChoices(list);
        setTitles(old=>({...old,...Object.fromEntries(list.map(row=>[row.id,row.title]))}));})
      .catch(()=>{if(!controller.signal.aborted)setChoices([]);});
    return ()=>controller.abort();
  },[locale,search]);
  const dirty=JSON.stringify(ids)!==JSON.stringify(saved);
  async function save(){
    setBusy(true);setError("");setSuccess("");
    try{
      const r=await fetch("/api/v1/packs/"+packId+"/recommendations",{method:"PUT",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({packIds:ids})});
      const response=await r.json();
      if(!r.ok)throw Error(response.message||response.error||"Save failed");
      setSaved([...ids]);setSuccess(ko?"추천 팩을 저장했습니다.":"Recommendations saved.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  return <section className="feature-card">
    <h2>{ko?"관련 퀴즈팩 · 선택":"Related packs · optional"}</h2>
    <p className="muted">{ko?"최대 3개의 공개 팩을 선택하세요. 선택한 순서대로 먼저 추천되고 나머지는 자동 추천됩니다. 추천만 변경하면 Kids 승인 상태는 유지됩니다.":
      "Choose up to 3 published packs in this language. Creator picks show first, and empty slots are automatic. Links alone do not reset Kids approval."}</p>
    <div className="pack-question-list">
      {ids.map((id,index)=><div className="pack-question" key={id}>
        <span className="pack-question-title">{index+1}. {titles[id]??id}</span>
        <div className="pack-question-actions">
          <button type="button" disabled={index===0||busy} aria-label={ko?"순서 올리기":"Move up"} onClick={()=>{
            setIds(old=>{const next=[...old];[next[index-1],next[index]]=[next[index],next[index-1]];return next;});
          }}>↑</button>
          <button type="button" disabled={index===ids.length-1||busy} aria-label={ko?"순서 내리기":"Move down"} onClick={()=>{
            setIds(old=>{const next=[...old];[next[index+1],next[index]]=[next[index],next[index+1]];return next;});
          }}>↓</button>
          <button type="button" disabled={busy} aria-label={ko?"제거":"Remove"} onClick={()=>setIds(old=>old.filter(value=>value!==id))}>×</button>
        </div>
      </div>)}
      {!ids.length&&<p className="muted">{ko?"현재 자동 추천을 사용합니다.":"Automatic recommendations are active."}</p>}
    </div>
    <label>{ko?"퀴즈팩 제목 검색":"Search published packs"}
      <input type="search" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)}
        placeholder={ko?"제목 입력":"Pack title"}/></label>
    <div className="pack-question-list">
      {choices.filter(item=>item.id!==packId&&!ids.includes(item.id)).map(item=>
        <button className="pack-add-question" key={item.id} type="button" disabled={busy||ids.length>=3}
          onClick={()=>{setIds(old=>[...old,item.id]);setSuccess("");}}>+ {item.title}</button>)}
    </div>
    <div className="actions">
      <button type="button" className="btn btn-primary" disabled={busy||!dirty} onClick={()=>void save()}>
        {busy?(ko?"저장 중…":"Saving…"):(ko?"추천 저장":"Save recommendations")}</button>
      {dirty&&<span className="muted">{ko?"미저장 변경사항":"Unsaved changes"}</span>}
    </div>
    {success&&<p role="status" className="feedback success">{success}</p>}
    {error&&<p role="alert" className="feedback">{error}</p>}
  </section>;
}
