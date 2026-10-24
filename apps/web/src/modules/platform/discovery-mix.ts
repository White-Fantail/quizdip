/** Deterministic daily catalog sampling and a fair, unranked discovery mix.
 * Never infer popularity from a random selection; eligibility is checked by the caller.
 */
export function rotatedCatalogOffset(total:number,recent:number,size:number,day:number,rotation:number):number {
  if(total<=recent)return recent;
  const windows=Math.ceil((total-recent)/size);
  const index=((day+rotation)%windows+windows)%windows;
  return Math.max(recent,Math.min(total-size,recent+index*size));
}
function hashPick(value:string):number {
  let valueHash=2166136261;
  for(let i=0;i<value.length;i++) {
    valueHash^=value.charCodeAt(i);
    valueHash=Math.imul(valueHash,16777619);
  }
  return valueHash>>>0;
}
export function mixDiscoveryCards<T extends {id:string;type:"PACK"|"QUIZ";creator:string}>(
  rows:T[],day:number,rotation:number,limit=6):T[] {
  const seed=day+":"+rotation+":";
  const ranked=(type:"PACK"|"QUIZ")=>rows.filter(row=>row.type===type).sort((a,b)=>
    hashPick(seed+a.id)-hashPick(seed+b.id)||a.id.localeCompare(b.id));
  const groups={PACK:ranked("PACK"),QUIZ:ranked("QUIZ")};
  const selected:T[]=[],used=new Set<string>(),authors=new Map<string,number>();
  while(selected.length<limit){
    const preferred=selected.length%2===0?"PACK":"QUIZ";
    const candidate=([preferred,preferred==="PACK"?"QUIZ":"PACK"] as const)
      .flatMap(type=>groups[type]).find(row=>
        !used.has(row.type+":"+row.id)&&(authors.get(row.creator)??0)<2);
    if(!candidate)break;
    selected.push(candidate);
    used.add(candidate.type+":"+candidate.id);
    authors.set(candidate.creator,(authors.get(candidate.creator)??0)+1);
  }
  return selected;
}
