/**
 * Browser-side durable outbox for finite PACK and RANDOM_FIVE runs.
 * Keep legacy quizdip-local-play-v1 records readable and never delete answers
 * solely because the server returned a successful response.
 */
export const LOCAL_RUN_PREFIX = "quizdip-local-play-v1:";

export type CachedProgress = {
  clueIndex:number;wrongGuesses:number;status:"ACTIVE"|"SOLVED"|"FAILED";
  score:number;mustReveal:boolean;hadWrongGuess?:boolean;firstChoice?:string;
  chanceHint?:{kind:"remove-choice";option:string}|{kind:"reveal-letter";index:number;character:string};
};
export type CachedRun = {
  bundle:{runId:string;questions:{position:number}[]};
  progress:Record<string,CachedProgress>;
  runToken:string;synced?:boolean;verified?:boolean;
};
export type CompletedResult = {
  position:number;cluesUsed:number;status:"SOLVED"|"FAILED";score:number;hadWrongGuess?:boolean;firstChoice?:string
};
export type SyncReceipt = {
  runId:string;completed:number;solved:number;failed:number;score:number;
  status:"ACTIVE"|"FINISHED";
};
export type RecoveryReport = {
  checked:number;recovered:number;failed:number;failures:{runId:string;message:string}[];
};

const inflight=new Map<string,Promise<SyncReceipt|null>>();
const storage=()=>typeof localStorage==="undefined"?null:localStorage;
export const runStorageKey=(runId:string)=>LOCAL_RUN_PREFIX+runId;

export function getCachedRun(runId:string):CachedRun|null {
  const store=storage();
  if(!store)return null;
  try{
    const saved=JSON.parse(store.getItem(runStorageKey(runId))||"null") as CachedRun|null;
    if(!saved||saved.bundle?.runId!==runId||!Array.isArray(saved.bundle.questions)||
       !saved.progress||typeof saved.progress!=="object"||Array.isArray(saved.progress)||
       typeof saved.runToken!=="string"||saved.runToken.length<32)return null;
    return saved;
  }catch{return null;}
}

export function storeCachedRun(saved:CachedRun):boolean {
  const store=storage();
  if(!store||!saved.bundle?.runId)return false;
  try{
    store.setItem(runStorageKey(saved.bundle.runId),JSON.stringify(saved));
    return true;
  }catch{return false;}
}

export function cachedCompletedResults(saved:CachedRun):CompletedResult[] {
  const positions=new Set(saved.bundle.questions.map(q=>q.position));
  const results:CompletedResult[]=[];
  for(const [key,progress] of Object.entries(saved.progress)){
    const position=Number(key);
    if(!Number.isSafeInteger(position)||position<0||!positions.has(position)||
       (progress?.status!=="SOLVED"&&progress?.status!=="FAILED"))continue;
    // Answer-first multiple choice intentionally has zero clues; retain completed rounds.
    if(!Number.isInteger(progress.clueIndex)||progress.clueIndex<0||progress.clueIndex>15||
       !Number.isFinite(progress.score))continue;
    results.push({position,cluesUsed:progress.clueIndex,status:progress.status,
      score:progress.status==="SOLVED"?Math.min(125,Math.max(0,Math.round(progress.score))):0,
      ...(progress.hadWrongGuess?{hadWrongGuess:true}:{}),
      ...(typeof progress.firstChoice==="string"?{firstChoice:progress.firstChoice}:{})});
  }
  return results.sort((a,b)=>a.position-b.position).slice(0,100);
}

export function cachedRunIds():string[] {
  const store=storage();
  if(!store)return [];
  const ids:string[]=[];
  try{
    for(let i=0;i<store.length;i++){
      const key=store.key(i);
      if(key?.startsWith(LOCAL_RUN_PREFIX)){
        const id=key.slice(LOCAL_RUN_PREFIX.length);
        if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))ids.push(id);
      }
    }
  }catch{/* A restricted storage environment simply has no recoverable cache. */}
  return ids;
}
function receiptMatches(receipt:SyncReceipt,results:CompletedResult[],saved:CachedRun):boolean{
  if(receipt.runId!==saved.bundle.runId)return false;
  const correct=results.filter(r=>r.status==="SOLVED").length;
  const failed=results.length-correct;
  const score=results.reduce((n,r)=>n+r.score,0);
  if(receipt.completed<results.length||receipt.solved<correct||
     receipt.failed<failed||receipt.score<score)return false;
  const finished=results.length===saved.bundle.questions.length;
  return !finished||receipt.status==="FINISHED";
}
/** Retry only temporary transport/server errors. Never repeat a 4xx validation
 * or authorization failure, and never mark a cache saved before acknowledgement.
 */
async function postSnapshotWithRetry(runId:string,body:string):Promise<any> {
  for(let attempt=0;attempt<3;attempt++){
    let res:Response;
    try{
      res=await fetch("/api/v1/runs/"+runId+"/sync",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},body
      });
    }catch(error){
      if(attempt===2)throw error;
      await new Promise(resolve=>setTimeout(resolve,80*2**attempt+Math.floor(Math.random()*25)));
      continue;
    }
    const response=await res.json().catch(()=>({}));
    if(res.ok)return response;
    if([429,500,502,503,504].includes(res.status)&&attempt<2){
      await new Promise(resolve=>setTimeout(resolve,80*2**attempt+Math.floor(Math.random()*25)));
      continue;
    }
    throw new Error(response.message||response.error||"Result save failed");
  }
  throw new Error("Result save failed after retries");
}

async function sendSnapshot(runId:string,force:boolean):Promise<SyncReceipt|null> {
  // Tab B may have saved another round while Tab A was awaiting its POST.
  // Re-read the durable cache under Web Locks and send the freshest snapshot.
  for(let attempt=0;attempt<6;attempt++){
    const saved=getCachedRun(runId);
    if(!saved)return null;
    const results=cachedCompletedResults(saved);
    if(!results.length)return null;
    if(saved.synced && saved.verified && !force)return null;
    const signature=JSON.stringify(results);
    const response=await postSnapshotWithRetry(runId,JSON.stringify({runToken:saved.runToken,results}));
    const receipt=response.data as SyncReceipt;
    if(!receipt || !receiptMatches(receipt,results,saved))
      throw new Error("Server did not confirm all completed questions");
    const current=getCachedRun(runId);
    if(!current)return receipt;
    if(signature!==JSON.stringify(cachedCompletedResults(current)))continue;
    // Mark only the exact snapshot acknowledged by the server. Preserve all
    // gameplay data for future recovery, even after confirmed sync.
    storeCachedRun({...current,synced:true,verified:true});
    return receipt;
  }
  throw new Error("Progress changed during save; retry shortly");
}

export async function syncCachedRun(runId:string,options:{force?:boolean}={}):Promise<SyncReceipt|null>{
  const previous=inflight.get(runId);
  if(previous)return previous; // An in-flight request also catches progress added while saving.
  const work=(async()=>{
    const doSend=()=>sendSnapshot(runId,!!options.force);
    if(typeof navigator!=="undefined" && navigator.locks?.request){
      // Serialize writes across tabs, too. Server uses Serializable transactions
      // in case clients lack the Web Locks API.
      return navigator.locks.request("quizdip:run-sync:"+runId,doSend);
    }
    return doSend();
  })();
  inflight.set(runId,work);
  try{return await work;}
  finally{if(inflight.get(runId)===work)inflight.delete(runId);}
}
export async function recoverCachedRuns(options:{
  onProgress?:(completed:number,total:number)=>void
}={}):Promise<RecoveryReport>{
  // Verify the old incorrectly marked synced results once, then only
  // send changed or unacknowledged snapshots on future visits.
  const ids=cachedRunIds().filter(id=>{
    const cached=getCachedRun(id);
    return !!cached&&cachedCompletedResults(cached).length>0&&
      (!cached.synced||!cached.verified);
  });
  const report:RecoveryReport={checked:ids.length,recovered:0,failed:0,failures:[]};
  // A bounded sequential sweep avoids overwhelming the DB with old sessions.
  for(const [index,id] of ids.entries()){
    try{
      const result=await syncCachedRun(id);
      if(result)report.recovered++;
    }catch(error){
      report.failed++;
      report.failures.push({runId:id,message:error instanceof Error?error.message:String(error)});
    }
    options.onProgress?.(index+1,ids.length);
  }
  return report;
}
