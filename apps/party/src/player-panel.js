// Live hand recognition and submitted answers are independent UI facts.
// This module never influences finger voting or player attribution.
export function playerPanelState({hand,answer,vote,phase,locale="ko"}){
 const korean=locale==="ko";
 const count=Number.isInteger(hand?.count)&&hand.count>=0&&hand.count<=5
  ?hand.count:null;
 const detected=count!==null;
 const fingers=detected?String(count):"—";
 const tracking=detected?(korean?"손 인식 중":"Hand tracked"):(korean?"인식 안 됨":"Hand missing");
 const submitted=Number.isInteger(answer?.choice)&&answer.choice>=0&&answer.choice<=3;
 let selection=submitted?
  (korean?"제출 "+(answer.choice+1)+"번 ✓":"Voted "+(answer.choice+1)+" ✓"):
  (korean?"미제출":"Not voted");
 if(!submitted&&phase==="playing"&&Number.isInteger(vote?.choice)&&vote.choice>=0&&vote.choice<=3){
  if(vote.phase==="countdown")
   selection=(korean?"선택 ":"Vote ")+(vote.choice+1)+" · "+Math.max(0,(vote.remainingMs??0)/1000).toFixed(1)+"s";
  else if(vote.phase==="arming")
   selection=(korean?"선택 ":"Vote ")+(vote.choice+1)+(korean?" 확인 중":" reading");
 }
 const progress=submitted?100:vote?.phase==="countdown"?
  Math.max(0,Math.min(100,Math.round((vote.progress??0)*100))):0;
 return {fingers,tracking,selection,detected,submitted,progress};
}
