import {db} from "./db";
import {fail,type Actor} from "./auth";

/** Anonymous, approximate UX events; never use these for verified gameplay or rankings. */
export async function recordGrowthEvent(p:Record<string,any>){
  const day=new Date();day.setUTCHours(0,0,0,0);
  await db().growthFunnelDaily.upsert({
    where:{day_event_locale_channel:{day,event:p.event,locale:p.locale,channel:p.channel}},
    create:{day,event:p.event,locale:p.locale,channel:p.channel,count:1},
    update:{count:{increment:1}}
  });
  return {recorded:true};
}
export async function adminGrowthReport(p:Record<string,any>,actor:Actor|null){
  if(actor?.role!=="ADMIN")fail(403,"forbidden","Administrator access required");
  const today=new Date();today.setUTCHours(0,0,0,0);
  const since=new Date(today);since.setUTCDate(since.getUTCDate()-(p.days-1));
  const rows=await db().growthFunnelDaily.findMany({where:{day:{gte:since}},orderBy:[{day:"asc"},{event:"asc"}]});
  const keys=["landing","teaser_click","quick_start","single_start","pack_start","first_answer","finish","share"];
  const blank=()=>Object.fromEntries(keys.map(key=>[key,0])) as Record<string,number>;
  const totals=blank(),daily=new Map<string,Record<string,number>>(),channels=new Map<string,Record<string,number>>();
  for(const row of rows){
    const date=row.day.toISOString().slice(0,10),d=daily.get(date)??blank(),c=channels.get(row.channel)??blank();
    totals[row.event]=(totals[row.event]||0)+row.count;
    d[row.event]=(d[row.event]||0)+row.count;
    c[row.event]=(c[row.event]||0)+row.count;
    daily.set(date,d);channels.set(row.channel,c);
  }
  return {days:p.days,startDay:since.toISOString().slice(0,10),endDay:today.toISOString().slice(0,10),totals,
    daily:[...daily].map(([day,counts])=>({day,counts})),
    channels:[...channels].map(([channel,counts])=>({channel,counts}))};
}
