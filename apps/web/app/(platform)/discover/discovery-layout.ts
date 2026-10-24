/** Give distinct cards to visible Discover lanes without falsifying their rankings.
 * A card is unique by content type and ID, even if an ID exists in both tables.
 */
export function uniqueDiscoveryRows<T extends {id:string;type:"PACK"|"QUIZ"},S extends {items:T[]}>(
  sections:S[],excludedIds:readonly string[]=[],perRow=3):S[] {
  const used=new Set(excludedIds);
  return sections.map(section=>{
    const items:T[]=[];
    for(const item of section.items){
      if(items.length>=perRow)break;
      const key=item.type+":"+item.id;
      if(used.has(key))continue;
      used.add(key);
      items.push(item);
    }
    return {...section,items};
  }).filter(section=>section.items.length>0) as S[];
}
