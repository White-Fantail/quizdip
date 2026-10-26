import {HandTracker,MAX_PLAYERS} from "./tracker.js";
import {answerAtPosition} from "./gestures.js";
import {foldSelection} from "./selection.js";
import {DEMO_QUESTIONS,freshGame,register,begin,submit,reveal,advance,lobbyStartStatus} from "./game.js";

const colors=["#80f5d1","#ffe27b","#f4a9df","#9cc3ff","#fbaa80"];
const params=new URLSearchParams(location.search);
const mouseTest=params.get("test")==="1";
let locale="ko",game=freshGame(),tracker=new HandTracker();
let videoStream=null,landmarker=null,frameHandle=0,seenHands=[],lastInference=0,lastInferDuration=0,backend="CPU",lastUiRefresh=0;
let revealUntil=0,stageStamp="",cameraReady=false,lobbyFistSince=null,testFists=false,lastLobbyUi=0;
const intents=new Map(),pointerNodes=new Map(),lastHandSeen=new Map();
const root=document.getElementById("app");
root.innerHTML='<div class="app"><div class="topline"><div class="logo">QuizDip <span>TOUCH</span></div><div style="display:flex;gap:10px;align-items:center"><span class="chip" id="status">CAMERA OFF</span><select id="locale" class="locale-select" aria-label="Language"><option value="ko">한국어</option><option value="en">English</option></select></div></div><main class="stage"><section id="top" class="question-zone"></section><section class="bottom-zone"><div class="camera-box"><video id="camera" autoplay muted playsinline aria-label="Local camera preview"></video><span class="camera-label" id="cameraLabel">Your camera stays on this device</span></div><div><div id="scores" class="scoreboard"></div><div id="messages" role="status" aria-live="polite"></div></div></section></main><footer class="foot" id="footer"></footer><div id="pointers"></div></div>';
const el=id=>document.getElementById(id);
const video=el("camera");
const t=(ko,en)=>locale==="ko"?ko:en;
const positionIndex=()=>Array.from(document.querySelectorAll("[data-answer]")).map(x=>x.getBoundingClientRect());
function updateHeader(){
 el("status").textContent=cameraReady?t("● 카메라 연결됨","● CAMERA READY"):t("카메라 연결 전","CAMERA OFF");
 el("cameraLabel").textContent=cameraReady
   ?t("번호 확인 "+seenHands.length+"/"+game.players.length+" · "+Math.round(lastInferDuration)+"ms · "+backend,
      "Identified "+seenHands.length+"/"+game.players.length+" · "+Math.round(lastInferDuration)+"ms · "+backend)
   :t("카메라 영상은 기기 밖으로 전송되지 않습니다","Camera video stays on this device");
 el("footer").textContent=t("손이 겹쳐 번호가 사라지면 자신의 번호만큼 손가락을 다시 펴주세요. 보기 안에서 손가락을 접어야 선택됩니다.",
"After overlap, show your numbered fingers again. Fold your fingers INSIDE an answer to select; passing through never selects.");
}
function showMessage(message,warning=false){
 el("messages").innerHTML='<div class="notice" style="margin:12px 0;'+(warning?'border-color:#eeb493;':'')+'">'+message+'</div>';
}
function updateScores(){
 el("scores").innerHTML=game.players.map(p=>{
  const hand=seenHands.find(h=>h.id===p.id);
  const detected=!!hand||(mouseTest&&!cameraReady);
  const label=game.phase==="lobby"&&hand
   ?(hand.gesture==="fist"?t("✊ 준비됨","✊ Ready"):hand.count===p.id?t("손가락 "+p.id+"개 확인","Finger "+p.id+" confirmed"):t("번호 포즈 유지","Hold your number"))
   :(detected?t("인식 중","Tracking"):t("손가락 "+p.id+"개를 다시 보여주세요","Show "+p.id+" fingers again"));
  return '<div class="player '+(cameraReady&&!detected?'offline':'')+'" style="--accent:'+colors[(p.id-1)%colors.length]+'"><b>P'+p.id+' · ✋'+p.id+'</b><b>'+p.score+'</b><em>'+label+'</em></div>';
 }).join("")||'<p style="grid-column:1/-1;color:#b8c8e4">'+t("손을 펼치고 카메라를 향해 주세요.","Show an open palm to the camera.")+'</p>';
}
function render(force=false){
 const stamp=game.phase+":"+game.round+":"+locale+":"+game.players.length;
 if(!force&&stamp===stageStamp)return;
 stageStamp=stamp;
 const top=el("top");
 if(game.phase==="lobby"){
  top.innerHTML='<div class="hero"><span class="chip">PARTY TRIVIA · '+MAX_PLAYERS+' PLAYERS</span><h1>'+t("손을 들어 정답을 맞혀라!","Your hands are the controllers!")+'</h1><p>'+t("손가락 개수로 번호를 정하세요: 1개=P1, 2개=P2, 3개=P3, 4개=P4, 5개=P5. 같은 번호를 보여주면 겹친 뒤에도 다시 연결됩니다.",
   "Hold 1–5 fingers to claim P1–P5. Show that same number after overlapping to reconnect.")+'</p></div>'+
   '<div class="hero"><strong>'+t("참가자","Players")+': <span id="playerCount">'+game.players.length+'</span>/5</strong>'+
   '<div class="actions"><button class="primary" id="enableCamera">'+t("카메라 시작","Start camera")+'</button>'+
   '<button class="secondary" id="resetPlayers">'+t("플레이어 초기화","Reset players")+'</button>'+
   (mouseTest?'<button class="secondary" id="testJoin">+ Test player</button><button class="secondary" id="testFists">'+(testFists?"✊ Release test fists":"✊ Hold test fists")+'</button>':'')+'</div>'+
   '<p class="start-instructions">'+t("번호 손가락을 0.8초간 보여주고, 전원이 ✊ 주먹을 1초간 유지하면 자동 시작!",
   "Hold your numbered fingers for 0.8 seconds, then everyone holds ✊ fists for 1 second to start!")+'</p>'+
   '<div class="start-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="'+t("전체 주먹 준비","All fists ready")+'"><div id="startProgressFill"></div></div>'+
   '<p id="readyStatus" aria-live="off">'+t("모두 등록한 뒤 함께 주먹을 쥐세요.","Register everyone, then make fists together.")+'</p>'+
   '<p>'+t("게임 중에는 번호 손가락을 펼친 채 보기로 이동한 다음, 그 안에서 주먹을 쥐어야 선택됩니다. 오래 머물거나 지나가기만 하면 선택되지 않습니다.",
   "Move your numbered fingers into a choice, then close into a fist INSIDE it. Hovering or passing through never selects.")+'</p></div>';
  el("enableCamera").onclick=()=>void startCamera();
  el("resetPlayers").onclick=()=>{game=freshGame();tracker.reset();seenHands=[];intents.clear();lastHandSeen.clear();lobbyFistSince=null;testFists=false;render(true);};
  if(mouseTest){
   el("testJoin").onclick=()=>{const n=[1,2,3,4,5].find(x=>!game.players.some(p=>p.id===x));if(n!==undefined)register(game,n);lobbyFistSince=null;render(true);};
   el("testFists").onclick=()=>{testFists=!testFists;lobbyFistSince=null;el("testFists").textContent=testFists?"✊ Release test fists":"✊ Hold test fists";};
  }
 }else if(game.phase==="playing"||game.phase==="revealed"){
  const q=DEMO_QUESTIONS[game.round],options=locale==="ko"?q.optionsKo:q.options;
  top.innerHTML='<div class="question-head"><span class="chip">'+t("문제","QUESTION")+' '+(game.round+1)+' / '+DEMO_QUESTIONS.length+'</span><span class="chip" id="countdown">20s</span><span class="chip">'+game.answers.size+' / '+game.players.length+' '+t("응답","VOTED")+'</span></div>'+
   '<h1 class="question">'+(locale==="ko"?q.ko:q.question)+'</h1><div class="choices">'+options.map((o,i)=>
     '<button class="choice '+(game.phase==="revealed"?(i===q.answer?'correct':''):'')+'" data-answer="'+i+'" '+(!mouseTest?'tabindex="-1"':'')+'>'+
     '<b>'+String.fromCharCode(65+i)+'</b><span>'+o+'</span><span class="vote" data-vote="'+i+'"></span></button>').join("")+'</div>';
  for(const b of document.querySelectorAll("[data-answer]"))b.onclick=()=>{
   if(!mouseTest||game.phase!=="playing")return;
   submit(game,game.players[0]?.id,Number(b.dataset.answer),performance.now());updateVotes();
  };
  updateVotes();
 }else{
  const sorted=[...game.players].sort((a,b)=>b.score-a.score);
  top.innerHTML='<div class="results"><span class="chip">QUIZDIP TOUCH · FINISHED</span><h2>🏆 '+t("최종 결과","Final results")+'</h2>'+
   sorted.map((p,i)=>'<div class="player" style="--accent:'+colors[(p.id-1)%colors.length]+'">'+(i+1)+'. P'+p.id+' — '+p.score+' pts · '+p.correct+'/'+DEMO_QUESTIONS.length+'</div>').join("")+
   '<div class="actions"><button class="primary" id="restart">'+t("다시 플레이","Play again")+'</button></div></div>';
  el("restart").onclick=()=>{game=freshGame();tracker.reset();seenHands=[];intents.clear();lastHandSeen.clear();lobbyFistSince=null;testFists=false;render(true);};
 }
 updateHeader();updateScores();
}
function updateVotes(){
 if(game.phase!=="playing"&&game.phase!=="revealed")return;
 const cards=[...document.querySelectorAll("[data-answer]")];
 cards.forEach((b,i)=>{
  const voters=[...game.answers.entries()].filter(([_,v])=>v.choice===i);
  const badge=b.querySelector("[data-vote]");if(badge)badge.textContent=voters.map(([id])=>{
   const p=game.players.find(x=>x.id===id);return p?"P"+p.id:"?";
  }).join(" ");
  if(game.phase==="revealed"&&i!==DEMO_QUESTIONS[game.round].answer&&voters.length)b.classList.add("wrong");
 });
}
function drawHands(hands){
 const active=new Set();
 for(const h of hands){
  const player=game.players.find(p=>p.id===h.id);
  if(!player)continue;
  active.add(h.id);
  let node=pointerNodes.get(h.id);
  if(!node){node=document.createElement("div");node.className="cursor";el("pointers").append(node);pointerNodes.set(h.id,node);}
  node.style.setProperty("--accent",colors[(player.id-1)%colors.length]);
  node.style.left=(h.x*100)+"vw";node.style.top=(h.y*100)+"vh";
  node.className="cursor "+(h.gesture==="fist"?"fist":"");
  node.textContent="P"+player.id;
 }
 for(const [id,node] of pointerNodes){if(!active.has(id)){node.remove();pointerNodes.delete(id);}}
}
function touchInputs(hands,now){
 if(game.phase!=="playing")return;
 const rects=positionIndex();
 for(const h of hands){
  if(!game.players.some(p=>p.id===h.id)||game.answers.has(h.id))continue;
  const selected=answerAtPosition(h.x*innerWidth,h.y*innerHeight,rects);
  const result=foldSelection(intents.get(h.id),h,selected,now);
  intents.set(h.id,result.state);
  if(result.chosen!==null&&submit(game,h.id,result.chosen,now)){
   updateVotes();showMessage(t("P"+h.id+" 선택 완료 ✊","P"+h.id+" answer confirmed ✊"));
  }
 }
}
function manageHands(hands,now){
 seenHands=hands;
 // An interrupted gesture cannot complete an answer when the hand returns.
 const visibleIds=new Set(hands.map(h=>h.id));
 for(const h of hands)lastHandSeen.set(h.id,now);
 // A short inference dropout while closing fingers may keep the armed choice.
 // Long gaps immediately disarm to avoid an accidental answer.
 for(const id of intents.keys())
  if(!visibleIds.has(id)&&now-(lastHandSeen.get(id)??-Infinity)>230)intents.delete(id);
 if(game.phase==="lobby"){
  let added=false;
  for(const h of tracker.candidates(now,780)){
   if(h.y>=.42)added=register(game,h.id)||added;
  }
  if(added){tracker.setRegistered(game.players.map(p=>p.id));lobbyFistSince=null;render(true);}
 }else touchInputs(hands,now);
 drawHands(hands);
}
function updateLobbyStart(now){
 if(game.phase!=="lobby")return;
 // Only recent camera observations may count toward readiness. Simulation is dev-only.
 const hands=mouseTest&&testFists
  ?game.players.map(p=>({id:p.id,gesture:"fist"}))
  :(cameraReady&&now-lastInference<Math.min(1100,Math.max(550,lastInferDuration*2.2+120))?seenHands:[]);
 const status=lobbyStartStatus(game,hands,now,lobbyFistSince);
 lobbyFistSince=status.since;
 const progress=Math.min(100,Math.round(status.elapsed/1000*100));
 const fill=el("startProgressFill");
 if(fill)fill.style.width=progress+"%";
 const bar=document.querySelector(".start-progress");
 if(bar)bar.setAttribute("aria-valuenow",String(progress));
 const statusEl=el("readyStatus");
 if(statusEl)statusEl.textContent=status.total===0
   ?t("손가락을 1~5개 펴서 0.8초 유지하면 해당 번호로 등록돼요.","Show 1–5 fingers for 0.8 seconds to register your number.")
   :status.visible!==status.total
     ?t("번호 확인된 참가자: "+status.visible+"/"+status.total+" — 모든 손이 보여야 시작해요.","Confirmed hands: "+status.visible+"/"+status.total+" — all must be visible.")
     :status.fists!==status.total
       ?t("주먹 준비: "+status.fists+"/"+status.total+" — 펼친 손도 등록은 유지돼요.","Fists ready: "+status.fists+"/"+status.total+" — open hands remain registered.")
       :t("모두 준비! 주먹을 유지하세요 · "+progress+"%","Everyone ready! Hold fists · "+progress+"%");
 if(status.ready && begin(game,now)){
  lobbyFistSince=null;testFists=false;intents.clear();el("messages").textContent="";render(true);
 }else if(now-lastLobbyUi>=260){updateScores();lastLobbyUi=now;}
}
function gameClock(now){
 if(game.phase==="lobby")updateLobbyStart(now);
 if(game.phase==="playing"){
  const sec=Math.max(0,Math.ceil((game.endTime-now)/1000));
  const countdown=el("countdown");if(countdown)countdown.textContent=sec+"s";
  if(now>=game.endTime||game.answers.size===game.players.length){
   reveal(game);revealUntil=now+3400;intents.clear();render(true);
   const idx=DEMO_QUESTIONS[game.round].answer;
   showMessage(t("정답은 "+DEMO_QUESTIONS[game.round].optionsKo[idx]+"!","Correct answer: "+DEMO_QUESTIONS[game.round].options[idx]+"!"));
  }
 }else if(game.phase==="revealed"&&now>=revealUntil){
  advance(game,now);intents.clear();render(true);el("messages").textContent="";
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
   tracker.setRegistered(game.players.map(p=>p.id));
   manageHands(tracker.update(detections.landmarks,completed),completed);
  }catch(e){
   lastInference=performance.now();
   showMessage(t("손 추적 오류: ","Tracking error: ")+String(e),true);
   landmarker.close();landmarker=null;cameraReady=false;lobbyFistSince=null;seenHands=[];
  }
 }
 const at=performance.now();
 gameClock(at);
 if(at-lastUiRefresh>320){updateScores();updateHeader();lastUiRefresh=at;}
 frameHandle=requestAnimationFrame(frame);
}
async function startCamera(){
 if(cameraReady)return;
 el("enableCamera").disabled=true;
 showMessage(t("카메라와 손 인식 모델을 연결하는 중…","Connecting camera and hand model…"));
 let stream;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error("HTTPS and a compatible browser are required");
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}}});
  video.srcObject=stream;await video.play();
  const {FilesetResolver,HandLandmarker}=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/+esm");
  const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm");
  const modelAssetPath="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  const config=delegate=>({
   baseOptions:{modelAssetPath,delegate},
   runningMode:"VIDEO",numHands:MAX_PLAYERS,minHandDetectionConfidence:.42,
   minHandPresenceConfidence:.40,minTrackingConfidence:.43
  });
  try{
   landmarker=await HandLandmarker.createFromOptions(vision,config("GPU"));
   backend="GPU";
  }catch{
   landmarker=await HandLandmarker.createFromOptions(vision,config("CPU"));
   backend="CPU";
  }
  videoStream=stream;cameraReady=true;lastInference=performance.now();lastInferDuration=0;el("messages").textContent="";lobbyFistSince=null;render(true);
  cancelAnimationFrame(frameHandle);frameHandle=requestAnimationFrame(frame);
 }catch(e){
  stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;
  showMessage(t("카메라를 시작할 수 없습니다: ","Could not start camera: ")+String(e),true);
  el("enableCamera").disabled=false;
 }
}
function cleanup(){
 cancelAnimationFrame(frameHandle);videoStream?.getTracks().forEach(t=>t.stop());
 landmarker?.close();landmarker=null;cameraReady=false;lobbyFistSince=null;
}
addEventListener("pagehide",cleanup);
el("locale").addEventListener("change",event=>{locale=event.target.value;render(true);});
render(true);
frameHandle=requestAnimationFrame(frame);
if(mouseTest)showMessage("Development test mode: use Test player then click choices.");
