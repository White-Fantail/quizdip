/** Non-blocking editorial guidance shared by REST, Studio and every MCP creator.
 * Automatic checks report observable evidence; humour, originality and delight
 * require human/agent judgment, never a made-up numeric quality score.
 */
export const funRubric = {
  version: "2026-10-19-v1",
  totalPoints: 100,
  scoreMode: "editorial_review_required",
  automaticScore: null,
  publicationBlocking: false,
  guidance: {
    ko: "저장 전 다섯 기준으로 팩을 검토하세요. 사실 정확성·정답의 유일성·아동 안전은 재미보다 우선합니다. 자동 점검은 신호일 뿐 재미를 채점하지 않습니다.",
    en: "Review all five criteria before publishing. Factual accuracy, uniquely defensible answers and child safety come first. Automatic checks are signals, not a fun score."
  },
  criteria: [
    { id: "opening", maxPoints: 20, titleKo: "첫 2문제의 흡입력", titleEn: "Opening hook",
      promptKo: "처음 두 문제가 호기심을 자극하고 계속 풀 이유를 주는가?",
      promptEn: "Do the first two questions create curiosity and a reason to continue?" },
    { id: "surprise", maxPoints: 25, titleKo: "놀라운 사실과 반전", titleEn: "Surprise and discovery",
      promptKo: "정답과 해설에 사실에 기반한 발견, 반전 또는 재미있는 맥락이 있는가? 억지 반전 금지.",
      promptEn: "Are there factually supported discoveries or delightful context after answers? Never fabricate surprises." },
    { id: "choices", maxPoints: 15, titleKo: "보기의 매력과 공정성", titleEn: "Answer choice appeal and fairness",
      promptKo: "보기들이 그럴듯하고 서로 구별되며 정답이 하나로 명확한가? 텍스트 정답형이면 단서의 공정성을 보라.",
      promptEn: "Are distractors plausible and distinct with one defensible answer? For text answers, assess fair clues instead." },
    { id: "flow", maxPoints: 20, titleKo: "문제 다양성과 흐름", titleEn: "Variety and pacing",
      promptKo: "비슷한 질문의 반복을 피하고 주제·난이도·질문 방식·파트 흐름에 리듬이 있는가?",
      promptEn: "Avoid repetitive prompts and vary angle, difficulty, format and chapter pacing where suitable." },
    { id: "ending", maxPoints: 20, titleKo: "마지막 문제와 결과의 여운", titleEn: "Memorable ending",
      promptKo: "마지막 문제와 팩 종료 메시지 또는 점수별 피드백이 만족스러운 마무리를 주는가?",
      promptEn: "Does the final question plus ending or score feedback leave a satisfying impression?" }
  ],
  workflow: ["draft_questions", "review_five_criteria", "revise_low_scoring_content", "pack_fun_review", "pack_publish_preview", "confirm_publish"],
  tool: "quizdip_pack_fun_review"
} as const;

export type FunQuestion = {
  id: string;
  title?: string | null;
  prompt?: string | null;
  explanation?: string | null;
  answer?: unknown;
  clues?: unknown;
  loaded?: boolean;
};
export type FunPackInput = {
  id: string; title: string; description: string; locale: string;
  orderMode: string; sections: unknown; closingMessage: string;
  scoreReviews: unknown; questions: FunQuestion[];
};
type Hint = {criterionId:string;code:string;messageKo:string;messageEn:string;questionPositions?:number[]};
const normalize=(s:string)=>s.normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase();
const filled=(s:unknown)=>typeof s==="string"&&s.trim().length>0;
export function evaluatePackFun(input:FunPackInput) {
  const all=input.questions, loaded=all.filter(q=>q.loaded!==false);
  const n=loaded.length;
  const explanations=loaded.filter(q=>filled(q.explanation)).length;
  const multiChoice=loaded.filter(q=>{
    const a=q.answer as {responseMode?:string;options?:unknown}|null;
    return a?.responseMode==="multiple-choice" || Array.isArray(a?.options);
  });
  const thinChoices=multiChoice.flatMap(q=>{
    const a=q.answer as {options?:unknown};
    return Array.isArray(a?.options)&&a.options.length<3?[all.indexOf(q)+1]:[];
  });
  const noClues=loaded.filter(q=>Array.isArray(q.clues)&&q.clues.length===0).length;
  const chapters=Array.isArray(input.sections)?input.sections.length:0;
  const scores=Array.isArray(input.scoreReviews)?input.scoreReviews.length:0;
  const repeats:number[]=[];
  const seen=new Set<string>();
  all.forEach((q,i)=>{
    const key=normalize(q.prompt??"");
    if(key && seen.has(key))repeats.push(i+1);
    if(key)seen.add(key);
  });
  const hints:Hint[]=[];
  function hint(criterionId:string,code:string,messageKo:string,messageEn:string,questionPositions?:number[]){
    hints.push({criterionId,code,messageKo,messageEn,...(questionPositions?.length?{questionPositions}:{})});
  }
  if(!filled(input.description))
    hint("opening","missing_introduction","팩 소개에 플레이어가 궁금해할 만한 한 문장을 넣어 보세요.","Consider a one-sentence hook in the pack description.");
  if(all.length>=2 && (!filled(all[0]?.prompt)||!filled(all[1]?.prompt)))
    hint("opening","opening_questions_unavailable","첫 두 문제의 도입을 직접 확인하세요.","Manually inspect the first two opening questions.");
  if(n>0 && explanations/n<0.5)
    hint("surprise","limited_explanations","정답 뒤에 짧고 정확한 발견·맥락을 제공할 문제를 골라 보세요. 모든 문제에 억지 해설을 넣을 필요는 없습니다.","Consider short, accurate discoveries after selected answers; avoid forced explanations.");
  if(thinChoices.length)
    hint("choices","few_distractors","일부 객관식에 보기 두 개만 있습니다. 의도한 형식인지, 오답이 그럴듯한지 검토하세요.","Some multiple-choice questions have only two options; check whether that is intentional and fair.",thinChoices.slice(0,15));
  if(repeats.length)
    hint("flow","duplicate_prompts","동일한 질문 문구가 반복됩니다. 다양한 접근으로 다시 써 보세요.","Repeated question prompts detected; vary the framing.",repeats.slice(0,15));
  if(input.orderMode==="RANDOM" && chapters>0)
    hint("flow","random_chapters","파트별 서사는 문제 순서를 고정했을 때 가장 자연스럽습니다.","Chapter narratives usually work best in creator-defined order.");
  if(!filled(input.closingMessage) && scores===0)
    hint("ending","missing_ending","마무리 한마디나 점수별 피드백을 고려해 보세요.","Consider a short ending message or score-based feedback.");
  if(loaded.length!==all.length)
    hint("flow","content_unavailable","일부 문제의 현재 언어 버전을 읽을 수 없습니다. 이 결과만으로 전체 품질을 판단하지 마세요.","Some localized questions were unavailable; do not treat this as a complete review.");
  return {
    rubricVersion:funRubric.version, packId:input.id, locale:input.locale,
    totalPossiblePoints:funRubric.totalPoints, score:null,
    scoreReason:"Subjective entertainment quality requires editorial/AI reading; metadata heuristics must not be presented as a 100-point score.",
    criteria:funRubric.criteria,
    evidence:{totalQuestions:all.length,readableQuestions:n,explanations,mcQuestions:multiChoice.length,
      noClueQuestions:noClues,chapterCount:chapters,scoreBandCount:scores,
      hasEnding:filled(input.closingMessage),hasDescription:filled(input.description),
      duplicatedPromptPositions:repeats},
    suggestions:hints,
    guidance:funRubric.guidance,
    mandatory:false,blocksPublication:false,
    nextStep:"Have the authoring AI or creator assess each of the five criteria, revise weak points, then run pack_publish_preview. Do not invent a score based on these checks."
  };
}
