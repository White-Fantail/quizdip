import { NextRequest, NextResponse } from "next/server";
import { startTouchGame, touchImage } from "../../../src/modules/platform/touch-party";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const allowed=(origin:string|null)=>{
 if(!origin)return null;
 try{
  const url=new URL(origin);
  if(url.protocol!=="https:"||url.pathname!=="/"||url.search)return null;
  if(["party.quizdip.com","quizdip-party.vercel.app",
      "quizdip-party-nomadonghos-projects.vercel.app",
      "quizdip-party-git-main-nomadonghos-projects.vercel.app",
      "touch.quizdip.com","quizdip-touch.vercel.app",
      "quizdip-touch-nomadonghos-projects.vercel.app",
      "quizdip-touch-git-dev-nomadonghos-projects.vercel.app"].includes(url.hostname))return origin;
  if(/^quizdip-(?:touch|party)-[a-z0-9-]+-nomadonghos-projects\.vercel\.app$/.test(url.hostname))return origin;
 }catch{}
 return null;
};
function cors(origin:string|null):Record<string,string>{
 return {"Cache-Control":"no-store","Vary":"Origin",
  ...(origin?{"Access-Control-Allow-Origin":origin}:{}),
  "Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
}
export function OPTIONS(request:NextRequest){
 const origin=allowed(request.headers.get("origin"));
 return new NextResponse(null,{status:204,headers:cors(origin)});
}
export async function POST(request:NextRequest){
 const sent=request.headers.get("origin"),origin=allowed(sent);
 if(sent&&!origin)return NextResponse.json({error:"Origin not allowed"},{status:403,headers:cors(origin)});
 if(Number(request.headers.get("content-length")||0)>6000)
  return NextResponse.json({error:"Invalid request size"},{status:413,headers:cors(origin)});
 try{
  const body=await request.json();
  if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("Invalid request");
  let result;
  if(body.action==="start")result=await startTouchGame(body.lane,body.locale);
  else if(body.action==="image")result=await touchImage(body.ticket,body.index);
  else return NextResponse.json({error:"Unknown action"},{status:400,headers:cors(origin)});
  return NextResponse.json(result,{headers:cors(origin)});
 }catch(error){
  const message=error instanceof Error?error.message:"Could not load QuizDip questions";
  const unavailable=/Not enough|unavailable|no longer available|unconfigured/i.test(message);
  return NextResponse.json({error:message},{status:unavailable?409:400,headers:cors(origin)});
 }
}
