// Visual diagnostics only: never feed this map back into player assignment or votes.
export const LOST_PREVIEW_MS=1000;
const clamp=value=>Math.max(0,Math.min(1,value));

export function trackingHudState(previous,zones,hands,now){
 const valid=Array.isArray(hands)?hands.filter(hand=>Number.isFinite(hand.x)&&Number.isFinite(hand.y)):[];
 const players=zones.map(zone=>{
  const observation=valid.find(hand=>hand.id===zone.id);
  const prior=previous?.players?.find(p=>p.id===zone.id);
  const missingSince=observation?null:(prior?.missingSince??now);
  const last=observation?{x:clamp(observation.x),y:clamp(observation.y)}:
   {x:prior?.x??clamp(zone.center),y:prior?.y??.5};
  return {id:zone.id,...last,online:Boolean(observation),
   missingSince,lost:missingSince!==null&&now-missingSince>=LOST_PREVIEW_MS};
 });
 const unknown=valid.filter(hand=>!zones.some(zone=>zone.id===hand.id))
  .map(hand=>({x:clamp(hand.x),y:clamp(hand.y)}));
 return {players,unknown};
}
