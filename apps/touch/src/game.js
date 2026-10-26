export const DEMO_QUESTIONS=[
 {question:"Which planet is called the Red Planet?",ko:"'붉은 행성'이라고 불리는 태양계 행성은?",options:["Venus","Mars","Jupiter","Saturn"],optionsKo:["금성","화성","목성","토성"],answer:1},
 {question:"Which animal has three hearts?",ko:"심장이 세 개 있는 동물은?",options:["Octopus","Dolphin","Shark","Penguin"],optionsKo:["문어","돌고래","상어","펭귄"],answer:0},
 {question:"Which is the largest ocean?",ko:"지구에서 가장 넓은 바다는?",options:["Atlantic","Indian","Pacific","Arctic"],optionsKo:["대서양","인도양","태평양","북극해"],answer:2},
 {question:"How many sides does a hexagon have?",ko:"육각형의 변은 몇 개일까?",options:["Five","Six","Seven","Eight"],optionsKo:["5개","6개","7개","8개"],answer:1},
 {question:"Which country is famous for the city of Petra?",ko:"고대 도시 페트라가 있는 나라는?",options:["Jordan","Greece","Egypt","Turkey"],optionsKo:["요르단","그리스","이집트","튀르키예"],answer:0},
 {question:"Which part of a plant usually absorbs water from soil?",ko:"식물이 땅에서 물을 흡수하는 주요 부분은?",options:["Flower","Leaf","Root","Fruit"],optionsKo:["꽃","잎","뿌리","열매"],answer:2},
 {question:"What is the fastest land animal?",ko:"가장 빠르게 달리는 육상 동물은?",options:["Lion","Horse","Cheetah","Ostrich"],optionsKo:["사자","말","치타","타조"],answer:2},
 {question:"Which instrument has black and white keys?",ko:"흰 건반과 검은 건반이 있는 악기는?",options:["Violin","Piano","Flute","Trumpet"],optionsKo:["바이올린","피아노","플루트","트럼펫"],answer:1}
];
export const ROUND_MS=30000;
export function freshGame(){return {phase:"lobby",players:[],round:0,answers:new Map(),endTime:0,startedAt:0};}
export function register(game,trackId){
 if(game.phase!=="lobby"||!Number.isInteger(trackId)||trackId<1||trackId>5||game.players.length>=5||
    game.players.some(p=>p.id===trackId))return false;
 game.players.push({id:trackId,trackId,score:0,correct:0});return true;
}
export function begin(game,now){
 if(game.phase!=="lobby"||game.players.length===0)return false;
 game.phase="playing";game.round=0;game.answers=new Map();game.endTime=now+ROUND_MS;game.startedAt=now;return true;
}
export function submit(game,trackId,choice,now,questions=DEMO_QUESTIONS){
 if(game.phase!=="playing"||now>game.endTime||game.answers.has(trackId)||!Number.isInteger(choice)||choice<0||choice>3)return false;
 const player=game.players.find(p=>p.trackId===trackId);if(!player)return false;
 const correct=choice===questions[game.round].answer;
 const points=correct?100+Math.max(0,Math.floor((game.endTime-now)/1000))*5:0;
 player.score+=points;if(correct)player.correct++;
 game.answers.set(trackId,{choice,correct,points});
 return true;
}
export function reveal(game){if(game.phase==="playing")game.phase="revealed";}
export function advance(game,now,questions=DEMO_QUESTIONS){
 if(game.phase!=="revealed")return false;
 if(game.round+1>=questions.length){game.phase="finished";return true;}
 game.round++;game.answers=new Map();game.endTime=now+ROUND_MS;game.phase="playing";return true;
}

