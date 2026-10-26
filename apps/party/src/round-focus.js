// The main timer is always visible during a round, even when everyone is
// resting their hands, thinking, or briefly out of the camera frame.
// The lobby confirms the players once; there is no per-question palm check.
export function roundFocusState({phase,remainingMs,totalMs}){
 const safeMs=Math.max(0,Number.isFinite(remainingMs)?remainingMs:0);
 const seconds=Math.ceil(safeMs/1000);
 const duration=Number.isFinite(totalMs)&&totalMs>0?totalMs:30000;
 const progress=Math.max(0,Math.min(1,safeMs/duration));
 if(phase==="revealed")return {mode:"revealed",seconds,progress};
 if(seconds<=3)return {mode:"critical",seconds,progress};
 if(seconds<=5)return {mode:"warning",seconds,progress};
 return {mode:"timer",seconds,progress};
}
