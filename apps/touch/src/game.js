export const ROUND_MS=30000;
export const TOUCH_COUNT=10;
export function freshGame(){return {phase:"lobby",players:[],questions:[],round:0,answers:new Map(),correctIndex:null,endTime:0,startedAt:0};}
export function setQuestions(game,questions){
 if(game.phase!=="lobby"||!Array.isArray(questions)||questions.length!==TOUCH_COUNT)return false;
 game.questions=questions;return true;
}
export function register(game,trackId){
 if(game.phase!=="lobby"||!Number.isInteger(trackId)||trackId<1||trackId>5||game.players.length>=5||
    game.players.some(p=>p.id===trackId))return false;
 game.players.push({id:trackId,trackId,score:0,correct:0});return true;
}
export function begin(game,now){
 if(game.phase!=="lobby"||game.players.length===0||game.questions.length!==TOUCH_COUNT)return false;
 game.phase="playing";game.round=0;game.answers=new Map();game.correctIndex=null;
 game.endTime=now+ROUND_MS;game.startedAt=now;return true;
}
export function submit(game,trackId,choice,now){
 if(game.phase!=="playing"||now>game.endTime||game.answers.has(trackId)||!Number.isInteger(choice)||choice<0||choice>3)return false;
 const player=game.players.find(p=>p.trackId===trackId);if(!player)return false;
 game.answers.set(trackId,{choice,at:now,correct:false,points:0});
 return true;
}
export function reveal(game,correctIndex){
 if(game.phase!=="grading"||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3)return false;
 game.correctIndex=correctIndex;
 for(const [id,answer] of game.answers){
  const p=game.players.find(player=>player.trackId===id);if(!p)continue;
  answer.correct=answer.choice===correctIndex;
  answer.points=answer.correct?100+Math.max(0,Math.floor((game.endTime-answer.at)/1000))*5:0;
  p.score+=answer.points;if(answer.correct)p.correct++;
 }
 game.phase="revealed";return true;
}
export function advance(game,now){
 if(game.phase!=="revealed")return false;
 if(game.round+1>=game.questions.length){game.phase="finished";return true;}
 game.round++;game.answers=new Map();game.correctIndex=null;game.endTime=now+ROUND_MS;game.phase="playing";return true;
}
