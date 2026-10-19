/** Pure deterministic ranking: editorial links, closely related content, then popular fallbacks. */
export type RankingCandidate={
  id:string;authorId:string;title:string;topicIds:string[];quizIds:string[];plays:number;updatedAt:number;
};
const filler=new Set(["the","and","quiz","quizzes","pack","part","episode","edition","basic","advanced","deep","dive","편","기본","기본편","심화","심화편","퀴즈","도전","게임"]);
export function titleTokens(title:string):string[]{
  return [...new Set((title.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu)??[])
    .filter(token=>token.length>1&&!filler.has(token)))];
}
export function rankRelatedPacks(
  source:Pick<RankingCandidate,"id"|"authorId"|"title"|"topicIds"|"quizIds">,
  candidates:RankingCandidate[],manualIds:string[],completedIds:string[]
):RankingCandidate[]{
  const manual=new Map(manualIds.map((id,index)=>[id,index]));
  const completed=new Set(completedIds);
  const sourceTokens=new Set(titleTokens(source.title));
  const sourceTopics=new Set(source.topicIds);
  const sourceQuestions=new Set(source.quizIds);
  function relevance(candidate:RankingCandidate){
    const sharedTokens=titleTokens(candidate.title).filter(token=>sourceTokens.has(token)).length;
    const sharedTopics=candidate.topicIds.filter(topic=>sourceTopics.has(topic)).length;
    const sharedQuestions=candidate.quizIds.filter(id=>sourceQuestions.has(id)).length;
    return sharedTokens*35+sharedTopics*24+sharedQuestions*8+
      (candidate.authorId===source.authorId?10:0)+
      Math.min(15,Math.log2(candidate.plays+1)*2);
  }
  return candidates.filter(item=>item.id!==source.id).sort((a,b)=>{
    const am=manual.get(a.id),bm=manual.get(b.id);
    if(am!==undefined||bm!==undefined)return (am??999)-(bm??999);
    // Already-completed packs are fallback only, after unplayed packs.
    if(completed.has(a.id)!==completed.has(b.id))return completed.has(a.id)?1:-1;
    const delta=relevance(b)-relevance(a);
    return delta||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id);
  });
}
