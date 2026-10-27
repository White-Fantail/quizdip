import {ZoneHandTracker,MAX_ZONE_PLAYERS} from "./zone-tracker.js";
import {fingerVote} from "./finger-vote.js";
import {updateLobbyHold,LOCK_HOLD_MS,LAUNCH_HOLD_MS} from "./lobby-hands.js";
import {TOUCH_COUNT,freshGame,setQuestions,register,begin,submit,reveal,advance,ROUND_MS} from "./game.js";
import {touchRequest,validateTouchSet} from "./source.js";
import {roundFocusState} from "./round-focus.js";

const colors=["#80f5d1","#ffe27b","#f4a9df","#9cc3ff","#fbaa80"];
const mouseTest=new URLSearchParams(location.search).get("test")==="1";
let locale="ko",game=freshGame(),tracker=new ZoneHandTracker(),recognitionPhase="scanning";
let videoStream=null,landmarker=null,frameHandle=0,seenHands=[],lastInference=0,lastInferDuration=0,backend="CPU";
let revealUntil=0,stageStamp="",cameraReady=false,lastUiRefresh=0,lastGoodFrame=0;
let selectedLane=null,gameTicket=null,loadedLocale=null,lobbyHold=null;
let loading=false,loadError="",loadRevision=0;
let lastFocusAnnouncement="",lastFocusElement=null,lastFocusRefresh=-Infinity;
const intents=new Map(),answeredPositions=new Map(),choiceMarkers=new Map();
const root=document.getElementById("app");
 // Safari's visible viewport changes as its bottom toolbar appears/disappears.
 // Fit the active round to the pixels the player can actually see.
 function syncVisibleViewport(){
  const height=window.visualViewport?.height??window.innerHeight;
  if(Number.isFinite(height)&&height>0)
   document.documentElement.style.setProperty("--party-visible-height",Math.round(height)+"px");
 }
 syncVisibleViewport();
 addEventListener("resize",syncVisibleViewport);
 addEventListener("orientationchange",syncVisibleViewport);
 window.visualViewport?.addEventListener("resize",syncVisibleViewport);
root.innerHTML='<div class="app"><div class="topline"><div class="logo">QuizDip <span>PARTY</span></div><div class="header-right"><span class="chip" id="status">CAMERA OFF</span><select id="locale" class="locale-select" aria-label="Language"><option value="ko">한국어</option><option value="en">English</option></select></div></div><main class="stage"><section id="top" class="question-zone"></section><section class="bottom-zone"><div class="camera-box"><video id="camera" autoplay muted playsinline aria-label="Local camera preview"></video><span class="camera-label" id="cameraLabel">Camera processed on this device</span><div id="cameraGuides" class="camera-guides"></div></div><div><div id="scores" class="scoreboard"></div><div id="messages" role="status" aria-live="polite"></div></div></section></main><footer class="foot" id="footer"></footer><div id="pointers"></div></div>';
const el=id=>document.getElementById(id);
const video=el("camera");
const t=(ko,en)=>locale==="ko"?ko:en;
const options=()=>[...document.querySelectorAll("[data-answer]")];
const color=id=>colors[(id-1)%colors.length];
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const questionLocale=()=>selectedLane==="KIDS"?"en":locale;
async function loadTenQuestions(){
 const revision=++loadRevision;
 loading=true;loadError="";gameTicket=null;game.questions=[];render(true);
 try{
  const data=validateTouchSet(await touchRequest("start",{lane:selectedLane,locale:questionLocale()}));
  if(revision!==loadRevision)return;
  if(data.locale!==questionLocale()||data.lane!==selectedLane||!setQuestions(game,data.questions))
   throw Error("QuizDip returned a different game");
  gameTicket=data.ticket;loadedLocale=data.locale;
  el("messages").textContent="";
 }catch(error){
  if(revision!==loadRevision)return;
  loadError=String(error instanceof Error?error.message:error);
  showMessage(t("문제를 불러오지 못했어요: ","Could not load quiz questions: ")+loadError,true);
 }finally{
  if(revision===loadRevision){loading=false;render(true);}
 }
}
function selectLane(lane){
 if(lane!=="GENERAL"&&lane!=="KIDS")return;
 selectedLane=lane;
 resetGame();
}
function changeLane(){
 loadRevision++;gameTicket=null;selectedLane=null;loadedLocale=null;
 game=freshGame();tracker.reset();recognitionPhase="scanning";seenHands=[];lobbyHold=null;
 cleanPlayUI();el("messages").textContent="";render(true);
}
function cleanPlayUI(){
 intents.clear();answeredPositions.clear();lastFocusAnnouncement="";
 for(const marker of choiceMarkers.values())marker.remove();
 choiceMarkers.clear();
}
function resetGame(){
 loadRevision++;game=freshGame();tracker.reset();recognitionPhase="scanning";
 seenHands=[];gameTicket=null;lobbyHold=null;cleanPlayUI();render(true);
 if(selectedLane)void loadTenQuestions();
}
function confirmPlayers(){
 const zones=tracker.lockPlayers(performance.now());
 if(!zones.length){showMessage(t("서로 떨어진 손을 1~5개 보여주고 약 1초 유지하세요.","Show 1–5 separated hands steadily for about a second."),true);return;}
 for(const zone of zones)register(game,zone.id);
 recognitionPhase="locked";lobbyHold=null;render(true);
}
function startRecognizedGame(){
 // Registration happens in the lobby. During rounds, resting with a fist is fine.
 // A fist (0) or open palm (5) is a neutral pose before choosing 1–4.
 if(loading||!gameTicket||!game.players.length||(!mouseTest&&!cameraReady))return;
 if(begin(game,performance.now())){cleanPlayUI();render(true);}
}
function cameraGuide(){
 const guide=el("cameraGuides");
 if(!guide)return;
 if(game.phase!=="lobby"||!selectedLane){guide.innerHTML="";return;}
 if(recognitionPhase==="locked"){
  guide.innerHTML=tracker.getZones().map(z=>
   '<div class="camera-lane" style="left:'+(z.left*100)+'%;width:'+((z.right-z.left)*100)+'%;--accent:'+color(z.id)+'">P'+z.id+'</div>'
  ).join("");
 }else{
  guide.innerHTML=tracker.candidates(performance.now(),230).map(h=>
   '<div class="camera-hand" style="left:'+(h.x*100)+'%;top:'+(h.y*100)+'%">✋</div>').join("");
 }
}
function updateHeader(){
 el("status").textContent=cameraReady?t("● 카메라 연결됨","● CAMERA READY"):t("카메라 연결 전","CAMERA OFF");
 el("cameraLabel").textContent=cameraReady
  ?t("손 "+tracker.visibleCount+"/5 · "+Math.round(lastInferDuration)+"ms · "+backend,
     "Hands "+tracker.visibleCount+"/5 · "+Math.round(lastInferDuration)+"ms · "+backend)
  :t("카메라 영상은 기기 밖으로 전송되지 않습니다","Camera video stays on this device");
 el("footer").textContent=!selectedLane?t("어른용 또는 어린이용을 선택하세요.","Choose Adult or Kids to play."):
  game.phase==="finished"?t("다시 플레이를 눌러 새 게임을 시작하세요.","Tap Play again for a new game."):
  game.phase==="playing"||game.phase==="revealed"
   ?t("주먹을 쥐고 편하게 생각하세요. 답을 알면 같은 자리에서 손가락 1~4개로 선택하세요.",
      "Relax with a fist while thinking. When ready, show 1–4 fingers in your lane to vote.")
   :recognitionPhase==="scanning"
    ?t("최대 다섯 손을 펼쳐 그대로 유지하면 인원이 자동 확정됩니다. 손가락 개수는 플레이어 번호가 아니에요.",
       "Hold up to five open hands steady to lock players automatically. Finger count is not player ID.")
    :t("같은 자리에서 손을 계속 펼쳐 유지하면 게임이 자동 시작됩니다.",
       "Keep your hands open in the same seats to start automatically.");
}
function showMessage(message,warning=false){
 const note=el("messages");
 note.textContent="";
 const div=document.createElement("div");div.className="notice";
 if(warning)div.style.borderColor="#eeb493";
 div.textContent=message;note.append(div);
}
function updateScores(){
 const board=el("scores");
 if(game.phase==="finished"||!selectedLane){board.innerHTML="";cameraGuide();return;}
 const scanning=game.phase==="lobby"&&recognitionPhase==="scanning";
 const candidates=scanning?tracker.candidates(performance.now()):[];
 const players=scanning?candidates.map((hand,i)=>({id:i+1,hand})):
  game.players.map(player=>({id:player.id,hand:seenHands.find(h=>h.id===player.id),player}));
 board.style.setProperty("--player-count",Math.max(1,players.length));
 board.classList.toggle("scanning",scanning);
 board.innerHTML=players.map(({id,hand,player})=>{
  const detected=!!hand||(mouseTest&&!cameraReady);
  const vote=game.phase==="playing"?intents.get(id):null;
  const answer=game.answers.get(id);
  const phase=answer?t("확정 ✓","VOTED ✓"):!detected?t("선택할 때 주먹부터 보여주세요","Show a fist when ready to vote"):
   vote?.phase==="neutral"?t("주먹으로 잠시 대기","Hold a fist briefly"):
   vote?.phase==="ready"?t("생각하다가 1~4개로 선택","Think, then show 1–4"):
   vote?.phase==="arming"?t("손가락 확인 중","Reading fingers"):
   vote?.phase==="countdown"?Math.max(0,vote.remainingMs/1000).toFixed(1)+"s":
   game.phase==="revealed"?t("정답 확인","Revealed"):
   game.phase==="lobby"?t("손 인식 완료","Hand confirmed"):t("주먹으로 쉬었다가 선택","Rest with a fist, then vote");
  const count=answer?String(answer.choice+1):hand?.count>=1&&hand?.count<=4?String(hand.count):
   hand?.count===5?"5":hand?.count===0?"✊":"—";
  const progress=answer?100:vote?.phase==="countdown"?Math.round(vote.progress*100):0;
  return '<div class="player '+(!detected?'offline':'')+'" style="--accent:'+color(id)+'"><div class="player-head"><b>P'+id+'</b><b>'+((player?.score??0))+' pt</b></div>'+
   '<strong class="player-gesture">'+count+'</strong><em>'+phase+'</em>'+
   '<div class="player-progress"><span style="width:'+progress+'%"></span></div></div>';
 }).join("")||(scanning?'<p class="waiting-players">'+t("최대 다섯 명까지 손을 보여주세요.","Show up to five hands.")+'</p>':"");
 const count=el("recognizedCount");
 if(count)count.textContent=scanning
  ?t("안정적으로 인식: ","Stable hands: ")+candidates.length+"/"+MAX_ZONE_PLAYERS
  :t("확정된 플레이어: ","Players locked: ")+game.players.length;
 const confirm=el("confirmPlayers");if(confirm)confirm.disabled=!cameraReady||candidates.length===0||
  candidates.length!==tracker.visibleCount;
 const beginButton=el("beginGame");
 if(beginButton)beginButton.disabled=loading||!gameTicket||(!mouseTest&&!cameraReady);
 const indicator=el("lobbyHandsStatus");
 if(indicator){
  const holding=!!lobbyHold?.signature && (lobbyHold?.progress??0)>0;
  indicator.classList.toggle("is-holding",holding);
  indicator.classList.toggle("is-ready",holding&&recognitionPhase==="locked"&&(lobbyHold?.progress??0)>=.65);
 }
 const meter=el("lobbyHoldProgress");
 if(meter)meter.style.width=Math.round((lobbyHold?.progress??0)*100)+"%";
 const status=el("lobbyHoldText");
 if(status){
  const validHands=scanning?candidates.length:seenHands.length;
  const target=scanning?tracker.visibleCount:game.players.length;
  const seconds=((1-(lobbyHold?.progress??0))*(scanning?LOCK_HOLD_MS:LAUNCH_HOLD_MS)/1000).toFixed(1);
  status.textContent=!cameraReady?t("카메라를 먼저 시작하세요","Start the camera first"):
   !scanning&&(loading||!gameTicket)?t("문제를 준비하는 중…","Loading questions…"):
   !target?t("1~5명의 손을 카메라에 보여주세요","Show 1–5 hands to the camera"):
   validHands!==target?t("손이 겹치지 않게 펼쳐주세요","Separate your hands"):
   !lobbyHold?.signature?t("모두 손을 쫙 펼쳐주세요 (엄지 제외 네 손가락 기준)",
      "Everyone, show an open palm (four long fingers)"):
   !scanning&&(lobbyHold?.progress??0)>=.65
    ?t("✓ 모두 준비 완료! 곧 시작합니다","✓ Everyone is ready! Starting soon") :
   scanning?t("인원 자동 확정까지 "+seconds+"초 · "+target+"명",
      "Locking "+target+" players in "+seconds+"s"):
    t("게임 자동 시작까지 "+seconds+"초","Starting in "+seconds+"s");
 }
 cameraGuide();
}
function render(force=false){
 const stamp=String(selectedLane)+":"+recognitionPhase+":"+loading+":"+loadError+":"+game.phase+":"+game.round+":"+locale+":"+game.players.map(p=>p.id).join("-");
 if(!force&&stamp===stageStamp)return;
 stageStamp=stamp;
 const top=el("top");top.classList.toggle("lobby-view",game.phase==="lobby");
 document.querySelector(".stage").classList.toggle("lobby-stage",game.phase==="lobby"&&!!selectedLane);
 top.classList.toggle("mode-view",!selectedLane);
 top.classList.toggle("finished-view",game.phase==="finished"&&!!selectedLane);
 document.querySelector(".stage").classList.toggle("results-stage",game.phase==="finished"&&!!selectedLane);
 document.querySelector(".stage").classList.toggle("selection-stage",!selectedLane);
 document.querySelector(".stage").classList.toggle("playing-stage",game.phase==="playing"||game.phase==="revealed");
 // Keep the lobby controls, but dedicate the full viewport to gameplay once a round starts.
 document.querySelector(".app").classList.toggle("play-session",game.phase==="playing"||game.phase==="revealed");
 document.querySelector(".app").classList.toggle("lobby-session",game.phase==="lobby"&&!!selectedLane);
 for(const marker of choiceMarkers.values())marker.remove();
 choiceMarkers.clear();
 if(!selectedLane){
  top.innerHTML='<div class="hero mode-hero"><span class="chip">QUIZDIP · PARTY</span><h1>'+
   t("어떤 게임을 할까요?","Choose a game!")+'</h1><p>'+t("QuizDip의 실제 공개 문제를 무작위로 10개씩 풀어요.","10 random questions from the real QuizDip!")+'</p></div>'+
   '<div class="mode-tiles"><button id="adultMode" class="mode-card adult"><span>🧠</span><strong>'+
   t("어른용 게임","Adult game")+'</strong><small>'+t("전체 공개 퀴즈에서 랜덤 10문제","10 questions from published quizzes")+
   '</small></button><button id="kidsMode" class="mode-card kids"><span>🦕</span><strong>'+
   t("어린이용 게임","Kids game")+'</strong><small>'+
   t("Kids 승인 문제 10개 · 현재 영어 콘텐츠","10 Kids-approved questions · English content")+
   '</small></button></div>';
  el("adultMode").onclick=()=>selectLane("GENERAL");
  el("kidsMode").onclick=()=>selectLane("KIDS");
 }else if(game.phase==="lobby"){
  const locked=recognitionPhase==="locked";
  top.innerHTML='<div class="hero lobby-hero"><span class="chip">PARTY TRIVIA · '+MAX_ZONE_PLAYERS+' PLAYERS</span><h1>'+
   (locked?t("플레이어 준비 완료","Players ready"):t("손 인식하기","Recognize players"))+'</h1><p>'+
   (locked?t("인원이 확정됐어요! 같은 자리에서 모두 손바닥을 펼쳐 유지하면 자동으로 시작해요.",
      "Players locked! Everyone keep an open palm visible to start automatically.")
    :t("최대 5명이 나란히 손을 펼쳐 보여주세요. 인원수가 안정되면 자동으로 확정돼요.",
       "Show up to five separated open palms. Hold steady to lock player count automatically."))+
   '</p><p class="content-badge">'+(selectedLane==="KIDS"
   ?t("🦕 어린이용 · 영어로 된 Kids 승인 문제","🦕 Kids · approved English questions")
   :t("🧠 어른용 · "+(questionLocale()==="ko"?"한국어":"English")+" 10문제",
      "🧠 Adult · "+(questionLocale()==="ko"?"Korean":"English")+" · 10 questions"))+
   '</p></div><div class="lobby-control"><span class="chip" id="recognizedCount"></span>'+
   '<div class="actions"><button class="secondary" id="enableCamera" '+(cameraReady?'disabled':'')+'>'+
    t(cameraReady?"카메라 연결됨":"카메라 시작",cameraReady?"Camera ready":"Start camera")+'</button>'+
   (locked?'<button class="secondary" id="beginGame" disabled>'+t("게임 시작","Start game")+'</button>'+
     '<button class="secondary" id="rescanPlayers">'+t("다시 인식","Rescan players")+'</button>'
    :'<button class="secondary" id="confirmPlayers" disabled>'+t("인원 확정","Lock players")+'</button>')+
   '<button class="secondary" id="changeMode">'+t("게임 종류 변경","Change mode")+'</button>'+
   (mouseTest?'<button class="secondary" id="testJoin">+ Test player</button>':"")+
   '</div></div><p class="ready-status">'+
   (locked?t("손을 움직이거나 화면을 누를 필요가 없어요. 손을 펼친 채 카운트다운을 기다리세요.",
      "No reaching or screen taps. Keep your hands open through the countdown.")
    :t("모두 손을 쫙 편 채로 유지하세요. 참가자가 추가되면 인식 카운트다운은 다시 시작됩니다.",
       "Keep your hands open. If someone joins, the recognition countdown restarts."))+
   '</p><div class="lobby-hands-status" id="lobbyHandsStatus"><strong id="lobbyHoldText"></strong>'+
   '<div class="lobby-hands-track"><span id="lobbyHoldProgress"></span></div></div>';
  el("enableCamera").onclick=()=>void startCamera();
  el("changeMode").onclick=changeLane;
  if(el("confirmPlayers"))el("confirmPlayers").onclick=confirmPlayers;
  if(el("rescanPlayers"))el("rescanPlayers").onclick=resetGame;
  if(el("beginGame"))el("beginGame").onclick=startRecognizedGame;
  if(mouseTest){
   el("testJoin").onclick=()=>{
    const id=game.players.length+1;
    if(id<=MAX_ZONE_PLAYERS){register(game,id);recognitionPhase="locked";render(true);}
   };
  }
  top.insertAdjacentHTML("beforeend",'<div class="loading-quiz" role="status">'+
   (loading?t("QuizDip에서 10문제를 불러오는 중…","Loading 10 questions from QuizDip…")
    :loadError?t("문제 로딩 실패. 아래 재시도를 누르세요.","Could not load questions. Try again.")
    :t("✓ 실제 퀴즈 10문제 준비 완료","✓ 10 QuizDip questions ready"))+
   (loadError?'<button class="primary" id="retryLoad">'+t("다시 불러오기","Retry loading")+'</button>':"")+
   '</div>');
  if(el("retryLoad"))el("retryLoad").onclick=()=>void loadTenQuestions();
 }else if(game.phase==="playing"||game.phase==="revealed"){
  const q=game.questions[game.round],answers=q.options;
  top.innerHTML='<div class="question-head"><span class="chip">'+t("문제","QUESTION")+' '+(game.round+1)+' / '+TOUCH_COUNT+
    '</span><span class="chip" id="answerCount">'+
    game.answers.size+' / '+game.players.length+' '+t("응답","VOTED")+'</span></div>'+
    '<div class="touch-question"><span class="question-source">'+
    (selectedLane==="KIDS"?"KIDS":"GENERAL")+' · '+(loadedLocale||questionLocale()).toUpperCase()+
    ' · QuizDip</span><h1 class="question">'+escapeHtml(q.prompt)+'</h1>'+
    (q.clue?'<p class="question-clue">'+escapeHtml(q.clue)+'</p>':"")+
    (q.mediaId?'<div class="question-media"><img id="roundImage" alt="QuizDip question clue" /></div>':"")+
    '</div><div class="choices">'+answers.map((answer,i)=>
    '<div class="choice '+(game.phase==="revealed"&&i===game.correctIndex?'correct':'')+'" data-answer="'+i+'"><b>'+
    (i+1)+'</b><span>'+escapeHtml(answer)+'</span><div class="vote" data-vote="'+i+'"></div></div>').join('')+
    '<div id="statusFocus" class="status-focus" data-mode="timer" aria-label="'+t("라운드 상태","Round status")+'">'+
    '<div class="status-focus__ring" aria-hidden="true"><strong id="focusValue">30</strong></div>'+
    '<strong id="focusHeadline" class="status-focus__headline"></strong>'+
    '<span id="focusDetail" class="status-focus__detail"></span>'+
    '<small id="focusTime" class="status-focus__time"></small>'+
    '<span id="focusAnnouncer" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true"></span></div></div>';
  if(q.mediaId)void showRoundImage(game.round,gameTicket);
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
  const winner=sorted[0];
  top.innerHTML='<div class="results"><span class="chip">QUIZDIP PARTY · FINISHED</span>'+
   '<h2>🏆 '+t("최종 결과","Final results")+'</h2>'+
   '<div class="result-winner" style="--accent:'+color(winner.id)+'"><span>🥇 P'+winner.id+'</span><strong>'+winner.score+' pts</strong><small>'+t("최고 점수","Top score")+'</small></div>'+
   '<div class="result-standings">'+sorted.map((p,i)=>
    '<div class="result-row" style="--accent:'+color(p.id)+'"><span>'+(i+1)+'. P'+p.id+'</span><strong>'+p.score+' pts</strong><small>'+p.correct+' / '+TOUCH_COUNT+' '+t("정답","correct")+'</small></div>'
   ).join('')+'</div>'+
   '<button type="button" id="restartZone" class="restart-zone" style="--replay-progress:0%">'+
    '<span class="restart-ring">↻</span><span class="restart-copy"><strong>'+t("다시 플레이","Play again")+'</strong>'+
    '<small id="restartHint">'+t("클릭하거나 터치해서 다시 플레이","Click or tap to play again")+'</small></span></button></div>';
  el("restartZone").onclick=resetGame;
 }
 updateHeader();updateScores();updateStatusFocus(performance.now());
}
// The four answer rectangles never move. One centered status station handles
// readiness, celebration, countdown, and urgency without shifting the layout.
function updateStatusFocus(now){
 const focus=el("statusFocus");if(!focus)return;
 // Keep the webcam inference loop responsive: DOM output updates at ~10fps,
 // but a freshly rendered round station is always initialized immediately.
 if(focus===lastFocusElement&&now-lastFocusRefresh<90)return;
 lastFocusElement=focus;lastFocusRefresh=now;
 const state=roundFocusState({phase:game.phase,remainingMs:game.endTime-now,totalMs:ROUND_MS});
 const words={
  timer:[t("남은 시간","Time remaining"),t("주먹을 쥐고 생각하다가 1~4개로 선택","Think with a relaxed fist; show 1–4 to vote")],
  warning:[t("서두르세요!","Hurry up!"),t("답을 알면 손가락 1~4개를 펴세요","Show 1–4 fingers to choose")],
  critical:[t("지금 선택!","Choose NOW!"),t("손가락 1~4개로 정답 선택","Vote with 1–4 fingers")],
  revealed:[t("정답 공개!","Answer revealed!"),t("편하게 손을 쉬고 다음 문제를 기다리세요","Relax your hand for the next round")]
 };
 const [headline,detail]=words[state.mode]??words.timer;
 focus.dataset.mode=state.mode;
 focus.style.setProperty("--time-progress",Math.round(state.progress*100)+"%");
 const numeral=state.mode==="revealed"?"✓":String(state.seconds);
 if(el("focusValue").textContent!==numeral)el("focusValue").textContent=numeral;
 if(el("focusHeadline").textContent!==headline)el("focusHeadline").textContent=headline;
 if(el("focusDetail").textContent!==detail)el("focusDetail").textContent=detail;
 const timeLabel=state.mode==="revealed"?"":t("남은 "+state.seconds+"초",state.seconds+"s left");
 if(el("focusTime").textContent!==timeLabel)el("focusTime").textContent=timeLabel;
 const announcement=state.mode;
 if(announcement!==lastFocusAnnouncement){
  lastFocusAnnouncement=announcement;
  el("focusAnnouncer").textContent=headline+" "+detail;
 }
 focus.closest(".choices")?.classList.toggle("time-critical",state.mode==="critical");
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
  if(game.phase==="revealed"&&choice!==game.correctIndex&&voted.length)node.classList.add("wrong");
 }
}
function refreshChoiceMarkers(){
 if(game.phase!=="playing"&&game.phase!=="revealed"){
  for(const marker of choiceMarkers.values())marker.remove();
  choiceMarkers.clear();return;
 }
 const entries=[];
 for(const player of game.players){
  const intent=intents.get(player.id),answer=game.answers.get(player.id);
  if(answer)entries.push({id:player.id,choice:answer.choice,confirmed:true,progress:1,label:"✓"});
  else if(intent?.choice!==null&&intent?.choice!==undefined&&
     (intent.phase==="arming"||intent.phase==="countdown"))
   entries.push({id:player.id,choice:intent.choice,confirmed:false,progress:intent.progress??0,
    label:intent.phase==="countdown"?(intent.remainingMs/1000).toFixed(1):"…"});
 }
 const active=new Set();
 for(const entry of entries){
  const option=document.querySelector('[data-answer="'+entry.choice+'"]');
  if(!option)continue;
  let marker=choiceMarkers.get(entry.id);
  if(!marker){marker=document.createElement("div");marker.className="dwell-marker";choiceMarkers.set(entry.id,marker);}
  if(marker.parentElement!==option)option.append(marker);
  active.add(entry.id);
  marker.className="dwell-marker "+(entry.confirmed?"confirmed":"countdown");
  marker.style.setProperty("--accent",color(entry.id));
  marker.style.setProperty("--progress",Math.round(entry.progress*100)+"%");
  marker.style.left=((entry.id-.5)/game.players.length*100)+"%";
  marker.style.top="calc(100% - 32px)";
  marker.textContent="P"+entry.id+" "+entry.label;
 }
 for(const [id,marker] of choiceMarkers)if(!active.has(id)){marker.remove();choiceMarkers.delete(id);}
}
async function showRoundImage(index,ticket){
 const img=el("roundImage");if(!img||!ticket)return;
 try{
  const {url}=await touchRequest("image",{ticket,index});
  if(gameTicket===ticket&&game.round===index&&el("roundImage")===img&&typeof url==="string")img.src=url;
 }catch{if(el("roundImage")===img)img.alt=t("이미지를 불러올 수 없습니다","Image unavailable");}
}
function touchInputs(hands,now){
 if(game.phase!=="playing")return;
 for(const player of game.players){
  if(game.answers.has(player.id))continue;
  const hand=hands.find(h=>h.id===player.id)??null;
  const decision=fingerVote(intents.get(player.id),hand,now);
  if(decision.state)intents.set(player.id,decision.state);
  else intents.delete(player.id);
  if(decision.chosen!==null&&submit(game,player.id,decision.chosen,now)){
   answeredPositions.set(player.id,{choice:decision.chosen});
   updateVotes();
  }
 }
 refreshChoiceMarkers();updateStatusFocus(now);
}
function manageHands(hands,now){
 seenHands=hands;lastGoodFrame=now;
 // Hands are the primary lobby control. A steady open palm is safer than
 // making everyone travel toward a button, and unlike a fist it keeps
 // landmarks continuously visible throughout recognition and countdown.
 if(selectedLane&&cameraReady&&!mouseTest&&game.phase==="lobby"){
  if(recognitionPhase==="scanning"){
   const candidates=tracker.candidates(now);
   lobbyHold=updateLobbyHold(lobbyHold,"scanning",candidates,tracker.visibleCount,now);
   if(lobbyHold.action==="lock")confirmPlayers();
  }else if(recognitionPhase==="locked"){
   lobbyHold=updateLobbyHold(lobbyHold,"locked",hands,game.players.length,now,!loading&&!!gameTicket);
   if(lobbyHold.action==="start")startRecognizedGame();
  }
 }
 if(game.phase==="playing")touchInputs(hands,now);
 updateScores();updateStatusFocus(now);
}
function gameClock(now){
 if(game.phase==="playing"){
  updateStatusFocus(now);
  if(now>=game.endTime||game.answers.size===game.players.length){
   if(reveal(game)){
    revealUntil=now+3400;intents.clear();render(true);
    showMessage(t("정답은 ","Correct answer: ")+game.questions[game.round].options[game.correctIndex]+"!");
   }else{
    showMessage(t("받아온 문제의 정답 정보가 올바르지 않습니다.","Invalid answer key in downloaded question."),true);
    // Bad data must not silently award points or advance; offer a new round.
    game.phase="finished";render(true);
   }
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
   manageHands(tracker.observe(detections.landmarks,completed),completed);
  }catch(error){
   lastInference=performance.now();cameraReady=false;seenHands=[];intents.clear();
   showMessage(t("손 추적 오류: ","Tracking error: ")+String(error),true);
   landmarker.close();landmarker=null;refreshChoiceMarkers();
  }
 }
 const current=performance.now();
 // Stalled inference must never leave a cursor or a dwell countdown active.
 if(current-lastGoodFrame>Math.min(1600,Math.max(800,lastInferDuration*2.8+230))&&seenHands.length){
  seenHands=[];intents.clear();
  if(game.phase==="lobby")updateScores();
  if(game.phase==="playing"){refreshChoiceMarkers();updateStatusFocus(current);}
  
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
  const config=delegate=>({baseOptions:{modelAssetPath,delegate},runningMode:"VIDEO",numHands:MAX_ZONE_PLAYERS,
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
el("locale").addEventListener("change",event=>{locale=event.target.value;if(selectedLane&&game.phase==="lobby"&&selectedLane==="GENERAL")void loadTenQuestions();render(true);});
render(true);
frameHandle=requestAnimationFrame(frame);
if(mouseTest)showMessage("Development test mode: join players, press Start game, then click answers.");
