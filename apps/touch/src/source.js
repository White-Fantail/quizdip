// Only QuizDip-controlled endpoints may supply game questions.
// Production uses the public QuizDip service; preview builds can select a
// reviewed QuizDip preview endpoint using the touchApi query parameter.
export function touchApiEndpoint(search="",hostname=""){
 const requested=new URLSearchParams(search).get("touchApi");
 if(!requested)return "https://quizdip.com/api/touch";
 try{
  const u=new URL(requested);
  if(u.protocol==="https:"&&u.pathname==="/api/touch"&&!u.search&&!u.hash&&
    (u.hostname==="quizdip.com"||
      /^quizdip-[a-z0-9-]+-nomadonghos-projects\.vercel\.app$/.test(u.hostname)))
    return u.href;
 }catch{}
 return "https://quizdip.com/api/touch";
}
export async function touchRequest(action,payload={},endpoint=touchApiEndpoint(location.search)){
 const response=await fetch(endpoint,{method:"POST",mode:"cors",cache:"no-store",
  headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
 const data=await response.json().catch(()=>({error:"QuizDip service did not return JSON"}));
 if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"QuizDip request failed");
 return data;
}
export function validateTouchSet(payload){
 if(!payload||typeof payload.ticket!=="string"||typeof payload.locale!=="string"||
   !Array.isArray(payload.questions)||payload.questions.length!==10||
   !payload.questions.every(q=>typeof q.id==="string"&&q.id.length>0&&
     typeof q.prompt==="string"&&q.prompt.length>0&&Array.isArray(q.options)&&q.options.length===4&&
     q.options.every(x=>typeof x==="string"&&x.length>0)&&
     (q.mediaId===null||typeof q.mediaId==="string")&&
     (q.clue===null||typeof q.clue==="string")))
  throw new Error("Incomplete or invalid ten-question game");
 return payload;
}
