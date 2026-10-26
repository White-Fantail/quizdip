// Pure per-round visual state. The 30-second clock and finger-vote rules are unchanged.
export const READY_CELEBRATION_MS=1050;
export function roundFocusState({phase,remainingMs,totalMs,readyCount,playerCount,allReadyAt,now}){
 const safeMs=Math.max(0,Number.isFinite(remainingMs)?remainingMs:0);
 const seconds=Math.ceil(safeMs/1000);
 const duration=Number.isFinite(totalMs)&&totalMs>0?totalMs:30000;
 const progress=Math.max(0,Math.min(1,safeMs/duration));
 if(phase==="revealed")return {mode:"revealed",seconds,progress};
 if(phase!=="playing")return {mode:"timer",seconds,progress};
 // At the deadline urgency overrides preparation so time is never hidden.
 if(seconds<=3)return {mode:"critical",seconds,progress};
 if(seconds<=5)return {mode:"warning",seconds,progress};
 if(playerCount>0&&readyCount<playerCount)return {mode:"prepare",seconds,progress};
 if(Number.isFinite(allReadyAt)&&now>=allReadyAt&&now-allReadyAt<READY_CELEBRATION_MS)
  return {mode:"ready",seconds,progress};
 return {mode:"timer",seconds,progress};
}
