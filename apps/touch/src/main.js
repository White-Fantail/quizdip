import {HandTracker,MAX_PLAYERS} from "./tracker.js";
import {answerAtPosition} from "./gestures.js";
import {dwellSelection,SELECT_ARM_MS,SELECT_COUNTDOWN_MS} from "./selection.js";
import {updateStartPads,START_HOLD_MS} from "./start-zones.js";
import {DEMO_QUESTIONS,freshGame,register,begin,submit,reveal,advance,ROUND_MS} from "./game.js";

const colors=["#80f5d1","#ffe27b","#f4a9df","#9cc3ff","#fbaa80"];
const mouseTest=new URLSearchParams(location.search).get("test")==="1";
let locale="ko",game=freshGame(),tracker=new HandTracker();
let videoStream=null,landmarker=null,frameHandle=0,seenHands=[],lastInference=0,lastInferDuration=0,backend="CPU";
let revealUntil=0,stageStamp="",cameraReady=false,lastUiRefresh=0,lastGoodFrame=0;
let startHolds=new Map();
const intents=new Map(),answeredPositions=new Map(),pointerNodes=new Map(),choiceMarkers=new Map();
const root=document.getElementById("app");
root.innerHTML='<div class="app"><div class="topline"><div class="logo">QuizDip <span>TOUCH</span></div><div class="header-right"><span class="chip" id="status">CAMERA OFF</span><select id="locale" class="locale-select" aria-label="Language"><option value="ko">한국어</option><option value="en">English</option></select></div></div><main class="stage"><section id="top" class="question-zone"></section><section class="bottom-zone"><div class="camera-box"><video id="camera" autoplay muted playsinline aria-label="Local camera preview"></video><span class="camera-label" id="cameraLabel">Camera processed on this device</span></div><div><div id="scores" class="scoreboard"></div><div id="messages" role="status" aria-live="polite"></div></div></section></main><footer class="foot" id="footer"></footer><div id="pointers"></div></div>';
const el=id=>document.getElementById(id);
const video=el("camera");
const t=(ko,en)=>locale==="ko"?ko:en;
const options=()=>[...document.querySelectorAll("[data-answer]")];
const rects=()=>options().map(x=>x.getBoundingClientRect());
const playerIDs=()=>game.players.map(p=>p.id);
const ownHand=h=>h&&h.count===h.id&&h.gesture==="open"&&game.players.some(p=>p.id===h.id);
const color=id=>colors[(id-1)%colors.length];
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
function cleanPlayUI(){
 intents.clear();answeredPositions.clear();
 for(const marker of choiceMarkers.values())marker.remove();
 choiceMarkers.clear();
}
function resetGame(){
 game=freshGame();tracker.reset();seenHands=[];startHolds.clear();cleanPlayUI();render(true);
}
function updateHeader(){
 el("status").textContent=cameraReady?t("● 카메라 연결됨","● CAMERA READY"):t("카메라 연결 전","CAMERA OFF");
 el("cameraLabel").textContent=cameraReady
  ?t("번호 확인 "+seenHands.length+"/"+game.players.length+" · "+Math.round(lastInferDuration)+"ms · "+backend,
     "Confirmed "+seenHands.length+"/"+game.players.length+" · "+Math.round(lastInferDuration)+"ms · "+backend)
  :t("카메라 영상은 기기 밖으로 전송되지 않습니다","Camera video stays on this device");
 el("footer").textContent=t("손가락 1~5개를 계속 유지하세요. 시작 구역과 정답 보기 안에 손을 머물러 선택합니다. 주먹을 쥘 필요가 없습니다.",
 "Keep your numbered fingers extended. Hold still in your own start zone or an answer to select. No fist needed.");
}
function showMessage(message,warning=false){
 const note=el("messages");
 note.textContent="";
 const div=document.createElement("div");div.className="notice";
 if(warning)div.style.borderColor="#eeb493";
 div.textContent=message;note.append(div);
}
function updateScores(){
 el("scores").innerHTML=game.players.map(p=>{
  const hand=seenHands.find(h=>h.id===p.id&&h.count===p.id);
  const detected=!!hand||(mouseTest&&!cameraReady);
  const label=game.phase==="lobby"&&startHolds.get(p.id)?.ready?t("시작 준비 완료","Ready to start")
   :detected?t("손가락 "+p.id+"개 인식 중",""+p.id+" fingers tracked")
   :t("손가락 "+p.id+"개를 다시 보여주세요","Show "+p.id+" fingers again");
  return '<div class="player '+(cameraReady&&!detected?'offline':'')+'" style="--accent:'+color(p.id)+'"><b>P'+p.id+' · ✋'+p.id+'</b><b>'+p.score+'</b><em>'+label+'</em></div>';
 }).join("")||'<p class="waiting-players">'+t("손가락 1~5개를 펼쳐 참가자를 등록하세요.","Show 1–5 raised fingers to join.")+'</p>';
}
function render(force=false){
 const stamp=game.phase+":"+game.round+":"+locale+":"+game.players.map(p=>p.id).join("-");
 if(!force&&stamp===stageStamp)return;
 stageStamp=stamp;
 const top=el("top");top.classList.toggle("lobby-view",game.phase==="lobby");
 for(const marker of choiceMarkers.values())marker.remove();
 choiceMarkers.clear();
 if(game.phase==="lobby"){
  top.innerHTML='<div class="hero lobby-hero"><span class="chip">PARTY TRIVIA · '+MAX_PLAYERS+' PLAYERS</span><h1>'+t("손가락 번호로 플레이!","Play with finger numbers!")+'</h1><p>'+
  t("P1~P5는 손가락 1~5개로 등록해요. 모두 등록한 후, 각자 자신의 시작 구역에 손을 올려 1.35초 유지하세요.",
    "Register as P1–P5 with 1–5 fingers. Once everyone joins, hold your numbered hand inside YOUR start zone for 1.35 seconds.")+
  '</p></div><div class="lobby-control"><span class="chip">'+t("등록된 플레이어","Registered")+': '+game.players.length+'/5</span>'+
  '<div class="actions"><button class="primary" id="enableCamera" '+(cameraReady?'disabled':'')+'>'+t(cameraReady?"카메라 연결됨":"카메라 시작",cameraReady?"Camera ready":"Start camera")+'</button>'+
  '<button class="secondary" id="resetPlayers">'+t("플레이어 초기화","Reset players")+'</button>'+
  (mouseTest?'<button class="secondary" id="testJoin">+ Test player</button><button class="secondary" id="testReady">Start (test only)</button>':'')+
  '</div></div><div class="start-zone-heading"><strong>'+t("각 플레이어의 시작 구역","Individual start zones")+'</strong><span>'+t("서로 다른 구역이므로 손이 겹치지 않아요","Separate lanes prevent hands overlapping")+'</span></div>'+
  '<div class="start-pads">'+[1,2,3,4,5].map(id=>{
   const joined=game.players.some(p=>p.id===id);
   return '<div class="start-pad '+(joined?'':'inactive')+'" style="--accent:'+color(id)+'" data-start="'+id+'"><div class="pad-number">P'+id+'</div><div class="pad-ring"><span id="pad-symbol-'+id+'">'+(joined?'✋':'—')+'</span></div><span id="pad-state-'+id+'">'+(joined?t("여기에 머물기","Hold here"):t("미등록","Not joined"))+'</span></div>';
  }).join('')+'</div><p id="readyStatus" class="ready-status">'+
   t("손가락 수를 바꾸지 않고 시작 구역으로 이동하세요. 모두 준비되면 게임이 자동 시작됩니다.",
     "Keep your assigned finger count unchanged. The game begins when everyone holds their own start zone.")+
  '</p>';
  el("enableCamera").onclick=()=>void startCamera();
  el("resetPlayers").onclick=resetGame;
  if(mouseTest){
   el("testJoin").onclick=()=>{
    const n=[1,2,3,4,5].find(x=>!game.players.some(p=>p.id===x));
    if(n!==undefined){register(game,n);tracker.setRegistered(playerIDs());startHolds.clear();render(true);}
   };
   el("testReady").onclick=()=>{if(begin(game,performance.now())){cleanPlayUI();render(true);}};
  }
  refreshPads({holds:startHolds,insideCount:0,readyCount:0,total:game.players.length,start:false});
 }else if(game.phase==="playing"||game.phase==="revealed"){
  const q=DEMO_QUESTIONS[game.round],answers=locale==="ko"?q.optionsKo:q.options;
  top.innerHTML='<div class="question-head"><span class="chip">'+t("문제","QUESTION")+' '+(game.round+1)+' / '+DEMO_QUESTIONS.length+
    '</span><span class="chip" id="countdown">'+Math.round(ROUND_MS/1000)+'s</span><span class="chip" id="answerCount">'+
    game.answers.size+' / '+game.players.length+' '+t("응답","VOTED")+'</span></div>'+
    '<h1 class="question">'+(locale==="ko"?q.ko:q.question)+'</h1><div class="choices">'+answers.map((answer,i)=>
    '<div class="choice '+(game.phase==="revealed"&&i===q.answer?'correct':'')+'" data-answer="'+i+'"><b>'+
    String.fromCharCode(65+i)+'</b><span>'+answer+'</span><div class="vote" data-vote="'+i+'"></div></div>').join('')+'</div>';
  // Mouse-only simulation; ordinary camera mode cannot click a choice.
  if(mouseTest)for(const node of options()){
   node.classList.add("test-clickable");
   node.onclick=()=>{
    if(game.phase!=="playing")return;
    const p=game.players[0];if(!p)return;
    if(submit(game,p.id,Number(node.dataset.answer),performance.now())){
     const box=node.getBoundingClientRect();
     answeredPositions.set(p.id,{choice:Number(node.dataset.answer),x:box.left+box.width*.5,y:box.top+box.height*.5});
     updateVotes();refreshChoiceMarkers();
    }
   };
  }
  updateVotes();refreshChoiceMarkers();
 }else{
  const sorted=[...game.players].sort((a,b)=>b.score-a.score);
  top.innerHTML='<div class="results"><span class="chip">QUIZDIP TOUCH · FINISHED</span><h2>🏆 '+t("최종 결과","Final results")+'</h2>'+
   sorted.map((p,i)=>'<div class="player" style="--accent:'+color(p.id)+'">'+(i+1)+'. P'+p.id+' — '+p.score+' pts · '+p.correct+'/'+DEMO_QUESTIONS.length+'</div>').join('')+
   '<div class="actions"><button class="primary" id="restart">'+t("다시 플레이","Play again")+'</button></div></div>';
  el("restart").onclick=resetGame;
 }
 updateHeader();updateScores();
}
function refreshPads(status){
 if(game.phase!=="lobby")return;
 for(let n=1;n<=5;n++){
  const pad=document.querySelector('[data-start="'+n+'"]');if(!pad)continue;
  const state=status.holds.get(n);
  const joined=game.players.some(p=>p.id===n);
  const progress=Math.round((state?.progress||0)*100);
  pad.style.setProperty("--ready-progress",progress+"%");
  pad.classList.toggle("holding",!!state);
  pad.classList.toggle("ready",!!state?.ready);
  const symbol=el("pad-symbol-"+n);if(symbol)symbol.textContent=state?.ready?"✓":joined?"✋":"—";
  const stateLabel=el("pad-state-"+n);
  if(stateLabel)stateLabel.textContent=!joined?t("미등록","Not joined"):state?.ready?t("준비 완료!","READY!"):
   state?t("시작까지 "+Math.max(0,(START_HOLD_MS-(state.lastAt-state.since))/1000).toFixed(1)+"초",
     Math.max(0,(START_HOLD_MS-(state.lastAt-state.since))/1000).toFixed(1)+"s to ready"):
   t("번호 손을 올리세요","Move numbered hand here");
 }
 const label=el("readyStatus");
 if(label)label.textContent=status.total===0?t("손가락 수로 참가자를 등록하세요.","Show numbered fingers to register."):
  t(status.readyCount+"/"+status.total+"명 준비 · 모두 자신의 구역에서 손가락 수를 유지하세요.",
    status.readyCount+"/"+status.total+" ready · everyone must hold their own pad with their number.");
}
function updateVotes(){
 if(game.phase!=="playing"&&game.phase!=="revealed")return;
 const count=el("answerCount");
 if(count)count.textContent=game.answers.size+" / "+game.players.length+" "+t("응답","VOTED");
 for(const node of options()){
  const choice=Number(node.dataset.answer);
  const label=node.querySelector("[data-vote]");
  if(!label)continue;
  const voted=[...game.answers.entries()].filter(([_,v])=>v.choice===choice);
  label.innerHTML=voted.map(([id])=>'<span class="voter-badge" style="--accent:'+color(id)+'">P'+id+' ✓</span>').join("");
  if(game.phase==="revealed"&&choice!==DEMO_QUESTIONS[game.round].answer&&voted.length)node.classList.add("wrong");
 }
}
function drawHands(hands){
 const active=new Set();
 for(const hand of hands){
  const player=game.players.find(p=>p.id===hand.id);
  if(!player||hand.count!==player.id)continue;
  active.add(hand.id);
  let node=pointerNodes.get(hand.id);
  if(!node){node=document.createElement("div");node.className="cursor";el("pointers").append(node);pointerNodes.set(hand.id,node);}
  node.style.setProperty("--accent",color(hand.id));
  node.style.left=hand.x*100+"vw";node.style.top=hand.y*100+"vh";
  node.textContent="P"+hand.id;
 }
 for(const [id,node] of pointerNodes)if(!active.has(id)){node.remove();pointerNodes.delete(id);}
}
function refreshChoiceMarkers(){
 if(game.phase!=="playing"&&game.phase!=="revealed"){
  for(const marker of choiceMarkers.values())marker.remove();choiceMarkers.clear();return;
 }
 const selections=[];
 for(const hand of seenHands){
  const state=intents.get(hand.id);
  if(!ownHand(hand)||!state||game.answers.has(hand.id))continue;
  selections.push({id:hand.id,choice:state.choice,x:hand.x*innerWidth,y:hand.y*innerHeight,
   confirmed:false,progress:state.progress||0,remaining:state.remainingMs||0,phase:state.phase});
 }
 for(const [id,answer] of answeredPositions){
  selections.push({id,choice:answer.choice,x:answer.x,y:answer.y,confirmed:true,progress:1,remaining:0,phase:"confirmed"});
 }
 const active=new Set();
 for(const entry of selections){
  const option=document.querySelector('[data-answer="'+entry.choice+'"]');
  if(!option)continue;
  const bounds=option.getBoundingClientRect();
  if(!(entry.x>=bounds.left&&entry.x<=bounds.right&&entry.y>=bounds.top&&entry.y<=bounds.bottom))continue;
  let marker=choiceMarkers.get(entry.id);
  if(!marker){marker=document.createElement("div");marker.className="dwell-marker";choiceMarkers.set(entry.id,marker);}
  if(marker.parentElement!==option)option.append(marker);
  active.add(entry.id);
  marker.className="dwell-marker "+(entry.confirmed?"confirmed":entry.phase);
  marker.style.setProperty("--accent",color(entry.id));
  marker.style.setProperty("--progress",Math.round(entry.progress*100)+"%");
  marker.style.left=clamp(entry.x-bounds.left+(entry.id%2===0?20:-20),45,bounds.width-45)+"px";
  marker.style.top=clamp(entry.y-bounds.top-48,34,bounds.height-34)+"px";
  marker.textContent=entry.confirmed?"P"+entry.id+" ✓":entry.phase==="countdown"
   ?"P"+entry.id+" "+(entry.remaining/1000).toFixed(1)+"s"
   :"P"+entry.id+" …";
 }
 for(const [id,marker] of choiceMarkers)if(!active.has(id)){marker.remove();choiceMarkers.delete(id);}
}
function touchInputs(hands,now){
 if(game.phase!=="playing")return;
 const positions=rects();
 const seen=new Set(hands.map(h=>h.id));
 for(const id of intents.keys())if(!seen.has(id))intents.delete(id);
 for(const hand of hands){
  if(!game.players.some(p=>p.id===hand.id)||game.answers.has(hand.id))continue;
  const choice=answerAtPosition(hand.x*innerWidth,hand.y*innerHeight,positions);
  const decision=dwellSelection(intents.get(hand.id),hand,choice,now);
  if(decision.state)intents.set(hand.id,decision.state);
  else intents.delete(hand.id);
  if(decision.chosen!==null&&submit(game,hand.id,decision.chosen,now)){
   answeredPositions.set(hand.id,{choice:decision.chosen,x:hand.x*innerWidth,y:hand.y*innerHeight});
   updateVotes();
  }
 }
 refreshChoiceMarkers();
}
function manageHands(hands,now){
 seenHands=hands;lastGoodFrame=now;
 if(game.phase==="lobby"){
  let added=false;
  for(const candidate of tracker.candidates(now,780)){
   if(candidate.y<.42)continue;
   added=register(game,candidate.id)||added;
  }
  if(added){tracker.setRegistered(playerIDs());startHolds.clear();render(true);}
  const visiblePads=[...document.querySelectorAll("[data-start]")];
  const pads=new Map(visiblePads.map(node=>[Number(node.dataset.start),node.getBoundingClientRect()]));
  const status=updateStartPads(startHolds,playerIDs(),hands,(id,hand)=>{
   const box=pads.get(id);if(!box)return false;
   const x=hand.x*innerWidth,y=hand.y*innerHeight;
   return x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom;
  },now);
  startHolds=status.holds;
  refreshPads(status);
  if(status.start&&begin(game,now)){cleanPlayUI();startHolds.clear();render(true);}
 }else touchInputs(hands,now);
 drawHands(hands);
}
function gameClock(now){
 if(game.phase==="playing"){
  const remaining=Math.max(0,Math.ceil((game.endTime-now)/1000));
  const countdown=el("countdown");if(countdown)countdown.textContent=remaining+"s";
  if(now>=game.endTime||game.answers.size===game.players.length){
   reveal(game);revealUntil=now+3400;intents.clear();render(true);
   const answer=DEMO_QUESTIONS[game.round],i=answer.answer;
   showMessage(t("정답은 "+answer.optionsKo[i]+"!", "Correct answer: "+answer.options[i]+"!"));
  }
 }else if(game.phase==="revealed"&&now>=revealUntil){
  advance(game,now);cleanPlayUI();render(true);el("messages").textContent="";
 }
}
function frame(now){
 if(video.readyState>=2&&landmarker&&now-lastInference>=Math.max(45,Math.min(125,lastInferDuration*.55))){
  const started=performance.now();
  try{
   const detections=landmarker.detectForVideo(video,started);
   const completed=performance.now();
   lastInferDuration=lastInferDuration*.7+(completed-started)*.3;
   lastInference=completed;
   tracker.setRegistered(playerIDs());
   manageHands(tracker.update(detections.landmarks,completed),completed);
  }catch(error){
   lastInference=performance.now();cameraReady=false;seenHands=[];startHolds.clear();intents.clear();
   showMessage(t("손 추적 오류: ","Tracking error: ")+String(error),true);
   landmarker.close();landmarker=null;drawHands([]);refreshChoiceMarkers();
  }
 }
 const current=performance.now();
 // Stalled inference must never leave a cursor or a dwell countdown active.
 if(current-lastGoodFrame>Math.min(1600,Math.max(800,lastInferDuration*2.8+230))&&seenHands.length){
  seenHands=[];startHolds.clear();intents.clear();drawHands([]);
  if(game.phase==="lobby")refreshPads({holds:startHolds,insideCount:0,readyCount:0,total:game.players.length,start:false});
  if(game.phase==="playing")refreshChoiceMarkers();
 }
 gameClock(current);
 if(current-lastUiRefresh>=300){updateScores();updateHeader();lastUiRefresh=current;}
 frameHandle=requestAnimationFrame(frame);
}
async function startCamera(){
 if(cameraReady)return;
 const button=el("enableCamera");if(button)button.disabled=true;
 showMessage(t("카메라와 손 인식 모델을 연결하는 중…","Connecting camera and hand model…"));
 let stream;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error("HTTPS and a compatible browser are required");
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}}});
  video.srcObject=stream;await video.play();
  const {FilesetResolver,HandLandmarker}=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/+esm");
  const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm");
  const modelAssetPath="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  const config=delegate=>({baseOptions:{modelAssetPath,delegate},runningMode:"VIDEO",numHands:MAX_PLAYERS,
   minHandDetectionConfidence:.42,minHandPresenceConfidence:.40,minTrackingConfidence:.43});
  try{landmarker=await HandLandmarker.createFromOptions(vision,config("GPU"));backend="GPU";}
  catch{landmarker=await HandLandmarker.createFromOptions(vision,config("CPU"));backend="CPU";}
  videoStream=stream;cameraReady=true;lastInference=performance.now();lastGoodFrame=lastInference;lastInferDuration=0;
  el("messages").textContent="";render(true);
 }catch(error){
  stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;cameraReady=false;
  showMessage(t("카메라를 시작할 수 없습니다: ","Could not start camera: ")+String(error),true);
  const button=el("enableCamera");if(button)button.disabled=false;
 }
}
function cleanup(){
 cancelAnimationFrame(frameHandle);videoStream?.getTracks().forEach(track=>track.stop());
 landmarker?.close();landmarker=null;cameraReady=false;
}
addEventListener("pagehide",cleanup);
el("locale").addEventListener("change",event=>{locale=event.target.value;render(true);});
render(true);
frameHandle=requestAnimationFrame(frame);
if(mouseTest)showMessage("Development test mode: join players and use Start (test only), then click answers.");
