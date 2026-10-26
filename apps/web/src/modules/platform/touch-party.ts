import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { playableQuizWhere } from "./content-locale";
import { disclosedAnswerChoices } from "./answer-options";
import { previewUrl } from "./storage";

const ROUND_COUNT = 10;
type Lane = "GENERAL" | "KIDS";
type Locale = "ko" | "en";
type Answer = { canonical?:string;aliases?:string[];responseMode?:string;options?:string[] };
type Clue = {type?:string;text?:string;mediaId?:string};
type Question = {id:string;version:number;title:string;prompt:string;clue:string|null;mediaId:string|null;options:string[];answer:Answer};
type Entry = {quizId:string;revisionId:string};
type Ticket = {v:1;lane:Lane;locale:Locale;seed:string;expires:number;entries:Entry[]};
type Candidate = {quizId:string; revisionId:string; version:number; title:string;prompt:string;clues:unknown;promptMediaIds:unknown;answer:unknown};

function key(){const secret=process.env.PLAY_RUN_SECRET;if(!secret || secret.length<32)throw new Error("Touch signing key unavailable");return secret;}
function mac(body:string){return createHmac("sha256",key()).update("quizdip:touch:v1:"+body).digest("base64url");}
function sign(ticket:Ticket){const body=Buffer.from(JSON.stringify(ticket),"utf8").toString("base64url");return body+"."+mac(body);}
function open(token:string):Ticket{
 if(typeof token!=="string"||token.length>5000)throw new Error("Invalid game ticket");
 const parts=token.split(".");
 if(parts.length!==2)throw new Error("Invalid game ticket");
 const expected=Buffer.from(mac(parts[0]),"utf8"),actual=Buffer.from(parts[1],"utf8");
 if(actual.length!==expected.length||!timingSafeEqual(expected,actual))throw new Error("Invalid game ticket");
 const data=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")) as Ticket;
 if(data.v!==1 || !["GENERAL","KIDS"].includes(data.lane) || !["ko","en"].includes(data.locale) ||
   !Number.isFinite(data.expires)||Date.now()>data.expires||data.entries?.length!==ROUND_COUNT ||
   typeof data.seed!=="string")throw new Error("Expired or invalid game");
 return data;
}
export function parseTouchCandidate(row:Candidate):{question:Omit<Question,"options"|"answer">;answer:Answer}|null {
 const a=row.answer as Answer;
 if(!a||a.responseMode!=="multiple-choice"||!Array.isArray(a.options)||a.options.length!==4||
   a.options.some(x=>typeof x!=="string"||!x.trim())||typeof a.canonical!=="string"||!a.canonical.trim())return null;
 const normalize=(x:string)=>x.normalize("NFKC").trim().toLocaleLowerCase();
 if(new Set(a.options.map(normalize)).size!==4||a.options.filter(x=>normalize(x)===normalize(a.canonical!)).length!==1)return null;
 if(!row.prompt?.trim() || !row.title?.trim())return null;
 const clues=Array.isArray(row.clues)?row.clues as Clue[]:[];
 const first=clues[0];
 // TOUCH shows the first published clue only. Unsupported media is not playable yet.
 if(first && !["text","image","image-reveal"].includes(first.type||""))return null;
 const mediaIds=Array.isArray(row.promptMediaIds)?row.promptMediaIds.filter((id):id is string=>typeof id==="string"):[];
 const mediaId=typeof first?.mediaId==="string"?first.mediaId:mediaIds[0]||null;
 return {question:{id:row.quizId,version:row.version,title:row.title,prompt:row.prompt,
   clue:typeof first?.text==="string"&&first.text.trim()?first.text.trim():null,
   mediaId},answer:a};
}
function shuffled<T>(input:T[]):T[]{
 const values=[...input];
 for(let i=values.length-1;i>0;i--){const j=randomBytes(4).readUInt32BE(0)%(i+1);[values[i],values[j]]=[values[j],values[i]];}
 return values;
}
async function getCurrent(ticket:Ticket,index:number){
 if(!Number.isInteger(index)||index<0||index>=ticket.entries.length)throw new Error("Invalid round");
 const {quizId,revisionId}=ticket.entries[index];
 const quiz=await db().quiz.findFirst({where:{id:quizId,...playableQuizWhere(ticket.locale,ticket.lane)},
   select:{localizations:{where:{locale:ticket.locale,status:"PUBLISHED"},select:{
     origin:true,revisions:{where:{id:revisionId},select:{id:true,answer:true,clues:true,promptMediaIds:true}}
   }}}});
 const loc=quiz?.localizations[0];
 if(!loc || (ticket.lane==="KIDS" && !["ORIGINAL","LEGACY"].includes(loc.origin)))
   throw new Error("Quiz is no longer available");
 const revision=loc.revisions[0];
 if(!revision)throw new Error("Quiz version is unavailable");
 return revision;
}
export async function startTouchGame(lane:Lane,locale:Locale){
 if(!["GENERAL","KIDS"].includes(lane)||!["ko","en"].includes(locale))throw new Error("Invalid game mode");
 // Same eligibility policy as QuizDip's play service, including Kids review.
 const rows=await db().quiz.findMany({where:playableQuizWhere(locale,lane),take:3500,select:{
   id:true,localizations:{where:{locale,status:"PUBLISHED"},select:{
     origin:true,publishedVersion:true,revisions:{select:{
       id:true,version:true,title:true,prompt:true,answer:true,clues:true,promptMediaIds:true
     }}
   }}
 }});
 const candidates:Candidate[]=[];
 for(const quiz of rows){
  const loc=quiz.localizations[0];
  if(!loc||loc.publishedVersion===null||(lane==="KIDS"&&!["ORIGINAL","LEGACY"].includes(loc.origin)))continue;
  const revision=loc.revisions.find(r=>r.version===loc.publishedVersion);
  if(revision)candidates.push({...revision,quizId:quiz.id,revisionId:revision.id});
 }
 const selected:{question:Omit<Question,"options"|"answer">;answer:Answer;revisionId:string}[]=[];
 const checkedMedia=new Map<string,boolean>();
 for(const row of shuffled(candidates)){
  const parsed=parseTouchCandidate(row);if(!parsed)continue;
  const clues=Array.isArray(row.clues)?row.clues as Clue[]:[];
  const mediaIds=[...(Array.isArray(row.promptMediaIds)?row.promptMediaIds:[]),
    ...clues.map(c=>c?.mediaId)].filter((v):v is string=>typeof v==="string");
  let valid=true;
  for(const id of new Set(mediaIds)){
   let okay=checkedMedia.get(id);
   if(okay===undefined){
    const asset=await db().mediaAsset.findUnique({where:{id},select:{kind:true,status:true,moderationStatus:true,deletedAt:true}});
    okay=!!asset&&asset.status==="READY"&&asset.moderationStatus==="APPROVED"&&!asset.deletedAt;
    checkedMedia.set(id,okay);
   }
   if(!okay){valid=false;break;}
  }
  if(valid&&parsed.question.mediaId){
   const asset=await db().mediaAsset.findUnique({where:{id:parsed.question.mediaId},select:{kind:true}});
   if(asset?.kind!=="image")valid=false;
  }
  if(!valid)continue;
  selected.push({...parsed,revisionId:row.revisionId});
  if(selected.length===ROUND_COUNT)break;
 }
 if(selected.length!==ROUND_COUNT)throw new Error("Not enough approved four-choice questions in this language");
 const seed=randomBytes(16).toString("hex");
 const ticket:Ticket={v:1,lane,locale,seed,expires:Date.now()+60*60*1000,
   entries:selected.map(q=>({quizId:q.question.id,revisionId:q.revisionId}))};
 return {lane,locale,total:ROUND_COUNT,ticket:sign(ticket),
   questions:selected.map((row,index)=>({
     ...row.question,
     options:disclosedAnswerChoices(row.answer,seed+":"+index),
     // Same authored canonical/aliases supplied by localRunBundle.
     // Touch scoring happens entirely on the device after download.
     answer:{canonical:row.answer.canonical,aliases:row.answer.aliases??[],responseMode:"multiple-choice"}
   }))};
}
export async function touchImage(token:string,index:number){
 const ticket=open(token),revision=await getCurrent(ticket,index);
 const ids=Array.isArray(revision.promptMediaIds)?revision.promptMediaIds.filter((v):v is string=>typeof v==="string"):[];
 const clue=Array.isArray(revision.clues)?revision.clues[0] as Clue|undefined:undefined;
 const id=clue?.mediaId||ids[0];
 if(!id)throw new Error("No image on this question");
 const asset=await db().mediaAsset.findFirst({where:{id,kind:"image",status:"READY",moderationStatus:"APPROVED",deletedAt:null},
   select:{storageKey:true,mimeType:true}});
 if(!asset)throw new Error("Question image is unavailable");
 return {url:await previewUrl(asset.storageKey,asset.mimeType)};
}
