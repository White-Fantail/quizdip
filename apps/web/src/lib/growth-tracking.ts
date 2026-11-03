"use client";
export type GrowthEvent="landing"|"teaser_click"|"quick_start"|"single_start"|"pack_start"|"first_answer"|"finish"|"share";
type Channel="home"|"discover"|"social"|"direct";
const sources=new Set<Channel>(["home","discover","social","direct"]);
/** One signal per step per browser tab session, no cookie, user ID or fingerprint.
 * Intentionally separate from authoritative PlayRun/gameplay statistics. */
export function trackGrowth(event:GrowthEvent,locale:"en"|"ko",source?:Channel){
  if(typeof window==="undefined"||typeof navigator==="undefined")return;
  if((navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true||navigator.doNotTrack==="1")return;
  if(/\/kids(?:\/|$)/.test(window.location.pathname)||new URLSearchParams(location.search).get("kids")==="true")return;
  try{
    const params=new URLSearchParams(window.location.search);
    const fromUrl=params.get("src") as Channel|null;
    const channel:Channel=source??(fromUrl&&sources.has(fromUrl)?fromUrl:null)??
      (window.location.pathname==="/ko"||window.location.pathname==="/en"?"home":
        (sessionStorage.getItem("quizdip:growth:channel") as Channel)||"direct");
    if(!sources.has(channel))return;
    if(source||(fromUrl&&sources.has(fromUrl)))sessionStorage.setItem("quizdip:growth:channel",channel);
    const key="quizdip:growth:v1:"+locale+":"+channel+":"+event;
    if(sessionStorage.getItem(key)==="1")return;
    sessionStorage.setItem(key,"1");
    void fetch("/api/v1/growth/events",{
      method:"POST",credentials:"same-origin",keepalive:true,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({event,locale,channel})
    }).catch(()=>{/* UX analytics must never block gameplay. */});
  }catch{/* Tracking disabled when storage is unavailable. */}
}
