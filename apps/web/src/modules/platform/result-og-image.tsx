import { ImageResponse } from "next/og";
import sharp from "sharp";
import { PlatformError } from "./auth";
import { runShareGet } from "./runs";

const size = {width:1200,height:630};
const imageHeaders = {"Content-Type":"image/png","Cache-Control":"public, max-age=300, s-maxage=3600"};

/** Korean quiz titles need explicit glyph coverage in Vercel's default Latin OG font.
 * Google Fonts returns a tiny subset restricted to the visible text. On network
 * errors, keep the image route available with the bundled font instead.
 */
async function loadKoreanFont(text:string):Promise<ArrayBuffer|null> {
  try {
    const cssUrl="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text="+
      encodeURIComponent(text.slice(0,200)+" 나의 점수 맞힌 문제 같은 버전의 점수만 비교할 수 있어요 QuizDip MY QUIZ PACK RESULT SCORE PTS CORRECT ANSWERS 0123456789 Compare scores only within the same version");
    const cssResponse=await fetch(cssUrl,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 6.1; rv:27.0) Gecko/20100101 Firefox/27.0"},signal:AbortSignal.timeout(1800)});
    if(!cssResponse.ok)return null;
    const css=await cssResponse.text();
    // Only fetch files from Google's fixed font host, never an arbitrary URL.
    const resource=css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype|woff)['"]?\)/);
    const fontUrl=resource?.[1]?.replace(/['"]/g,"");
    if(fontUrl && !fontUrl.startsWith("https://fonts.gstatic.com/"))return null;
    if(!fontUrl)return null;
    const font=await fetch(fontUrl,{signal:AbortSignal.timeout(1800)});
    if(!font.ok)return null;
    const bytes=await font.arrayBuffer();
    return bytes.byteLength>0 && bytes.byteLength<1000000 ? bytes : null;
  } catch{return null;}
}

export async function resultOgImage(shareId:string):Promise<Response> {
  let result;
  try{result=await runShareGet({shareId});}
  catch(error){if(error instanceof PlatformError && error.status===404)
    return new Response("Not Found",{status:404});
    throw error;
  }
  const korean=result.locale==="ko";
  const score=new Intl.NumberFormat(korean?"ko-KR":"en-US").format(result.score);
  const koreanFont=await loadKoreanFont(result.title);
  const fonts=koreanFont?[{name:"QuizDipKorean",data:koreanFont,weight:700 as const,style:"normal" as const}]:[];
  try {
  const image = new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",
      color:"#fff",background:"linear-gradient(120deg, #5044cd, #7a65ed 65%, #342385)",
      padding:"55px 68px",fontFamily:koreanFont?"QuizDipKorean":"sans-serif",justifyContent:"space-between"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:42,fontWeight:800,letterSpacing:-2}}>QuizDip</span>
          <span style={{display:"flex",width:14,height:14,borderRadius:"50%",backgroundColor:"#fff",flexShrink:0}} />
        </div>
        <span style={{display:"flex",fontSize:22,opacity:.86}}>
          {result.packVersion!=null?`v${result.packVersion} · `:""}MY QUIZ PACK RESULT
        </span>
      </div>
      <div style={{display:"flex",fontSize:56,fontWeight:800,lineHeight:1.17,
        maxWidth:1050,overflow:"hidden",textOverflow:"ellipsis",maxHeight:151}}>
        {result.title}
      </div>
      <div style={{display:"flex",borderRadius:26,padding:"25px 38px",
        background:"#fff",color:"#251e4a",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",flexDirection:"column"}}>
          <span style={{fontSize:19,color:"#68627f"}}>{korean?"나의 점수":"MY SCORE"}</span>
          <span style={{display:"flex",alignItems:"baseline",color:"#6253de",fontSize:82,fontWeight:900}}>
            {score}<span style={{fontSize:24,marginLeft:8}}>{korean?"점":"PTS"}</span>
          </span>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
          <span style={{fontSize:42,fontWeight:800}}>{result.solved} / {result.completed}</span>
          <span style={{fontSize:19,color:"#68627f"}}>{korean?"맞힌 문제":"CORRECT ANSWERS"}</span>
        </div>
      </div>
      <div style={{display:"flex",fontSize:20,justifyContent:"space-between",opacity:.90}}>
        <span>{korean?"같은 버전의 점수만 비교할 수 있어요":"Compare scores only within the same version"}</span>
        <span>QuizDip</span>
      </div>
    </div>,{...size,fonts});
    // Rendering happens lazily in ImageResponse. Materialize it here so that
    // a font or Satori error is caught before Facebook sees a 500 response.
    return new Response(await image.arrayBuffer(),{headers:imageHeaders});
  } catch (error) {
    console.error("QuizDip result Open Graph image fallback",error);
    // Always return a valid PNG to crawlers, even when a font or renderer fails.
    const escaped=result.title.slice(0,72).replace(/[&<>"']/g,ch=>
      ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]||ch));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="1200" height="630" fill="#5143cb"/>
      <text x="70" y="106" fill="white" font-size="46" font-family="sans-serif" font-weight="bold">QuizDip</text>
      <text x="70" y="245" fill="white" font-size="46" font-family="sans-serif" font-weight="bold">${escaped}</text>
      <text x="70" y="295" fill="white" font-size="24" font-family="sans-serif">${result.packVersion!=null?"v"+result.packVersion:"Legacy result"}</text>
      <rect x="70" y="320" width="1060" height="238" rx="28" fill="white"/>
      <text x="105" y="388" fill="#5143cb" font-size="28" font-family="sans-serif">SCORE</text>
      <text x="105" y="488" fill="#5143cb" font-size="86" font-family="sans-serif" font-weight="bold">${score}</text>
      <text x="865" y="470" fill="#252242" font-size="43" font-family="sans-serif">${result.solved} / ${result.completed}</text>
    </svg>`;
    const png=await sharp(Buffer.from(svg)).png().toBuffer();
    return new Response(new Uint8Array(png).buffer as ArrayBuffer,{headers:imageHeaders});
  }
}
