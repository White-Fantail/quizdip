import { authPool } from "../../lib/auth";
import { resolveAnalyticsFilters, type AnalyticsFilters } from "./admin-content-analytics";

type SourceRow = Record<string, unknown>;
export type RisingKind = "pack" | "question";
export function resolveRisingKind(value: unknown): RisingKind {
  return value === "question" ? "question" : "pack";
}
export type Insight = {
  id:string; title:string; kind:"pack"|"question"; plays:number;
  previous:number; growth:number|null; newActivity:boolean; difference:number;
};
export type QualitySignal = {
  id:string; title:string; kind:"pack"|"question"; issue:"dropoff"|"too_easy"|"too_hard"|"low_completion";
  plays:number; completed:number; rate:number;
};
const n = (x:unknown) => Number(x ?? 0);
const pf = `r."startedAt" >= $1 AND r."startedAt" < $2
  AND ($3::text = 'all' OR r."locale" = $3)
  AND ($4::text = 'all' OR ($4::text = 'KIDS' AND (r."lane"='KIDS' OR kr."runId" IS NOT NULL))
       OR ($4::text = 'GENERAL' AND r."lane"='GENERAL' AND kr."runId" IS NULL))
  AND ($5::text = 'all' OR r."mode" = $5)
  AND ($6::text = '' OR p."authorId" = $6)`;
const qf = `s."startedAt" >= $1 AND s."startedAt" < $2
  AND ($3::text = 'all' OR s."locale" = $3)
  AND ($4::text = 'all' OR ($4::text = 'KIDS' AND (r."lane"='KIDS' OR kr."runId" IS NOT NULL OR ks."sessionId" IS NOT NULL))
       OR ($4::text = 'GENERAL' AND ks."sessionId" IS NULL AND kr."runId" IS NULL AND (r."lane"='GENERAL' OR r."id" IS NULL)))
  AND ($5::text = 'all' OR ($5::text = 'DISCOVER' AND s."runId" IS NULL) OR r."mode" = $5)
  AND ($6::text = '' OR q."authorId" = $6)`;
const packFrom = `FROM "PlayRun" r JOIN "QuizPack" p ON p."id"=r."packId"
 LEFT JOIN "KidPlayRun" kr ON kr."runId"=r."id"`;
const questionFrom = `FROM "PlaySession" s JOIN "Quiz" q ON q."id"=s."quizId"
 JOIN "QuizRevision" v ON v."id"=s."revisionId"
 LEFT JOIN "PlayRun" r ON r."id"=s."runId"
 LEFT JOIN "KidPlayRun" kr ON kr."runId"=r."id"
 LEFT JOIN "KidPlaySingle" ks ON ks."sessionId"=s."id"`;
const packSql = `SELECT p."id", MAX(p."title") AS title, COUNT(*) AS plays,
  COUNT(*) FILTER (WHERE r."status"='FINISHED') AS completed
  ${packFrom} WHERE r."mode"='PACK' AND ${pf}
  GROUP BY p."id" ORDER BY plays DESC LIMIT 1000`;
const questionSql = `SELECT q."id", MAX(v."title") AS title, COUNT(*) AS plays,
  COUNT(*) FILTER (WHERE s."status" IN ('SOLVED','FAILED')) AS completed,
  COUNT(*) FILTER (WHERE s."status"='SOLVED') AS solved
  ${questionFrom} WHERE ${qf}
  GROUP BY q."id" ORDER BY plays DESC LIMIT 1000`;

function params(f:AnalyticsFilters,start:Date,end:Date):unknown[]{
  return [start,end,f.locale,f.audience,f.mode,f.creator];
}
async function rows(sql:string,args:unknown[]):Promise<SourceRow[]>{
  return (await authPool().query(sql,args)).rows as SourceRow[];
}
/** Rankings never score tiny sample sizes as "viral". */
export function risingContent(current:SourceRow[],old:SourceRow[],kind:Insight["kind"]):Insight[]{
  const previous=new Map(old.map(row=>[String(row.id),n(row.plays)]));
  return current.flatMap(row=>{
    const plays=n(row.plays),before=previous.get(String(row.id))??0;
    const difference=plays-before;
    if(plays<10 || difference<8 || (before>0 && (before<5 || difference/before<0.5)))return [];
    return [{id:String(row.id),title:String(row.title),kind,plays,previous:before,
      difference,newActivity:before===0,growth:before>0?difference/before:null}];
  });
}
export function qualitySignals(packs:SourceRow[],questions:SourceRow[]):QualitySignal[]{
  const signals:QualitySignal[]=[];
  for(const p of packs){
    const starts=n(p.plays),completed=n(p.completed);
    if(starts>=20 && completed/starts<0.5)
      signals.push({id:String(p.id),title:String(p.title),kind:"pack",
        issue:"low_completion",plays:starts,completed,rate:completed/starts});
  }
  for(const q of questions){
    const starts=n(q.plays),answered=n(q.completed),solved=n(q.solved);
    if(starts>=20 && answered/starts<0.6)signals.push({
      id:String(q.id),title:String(q.title),kind:"question",issue:"dropoff",
      plays:starts,completed:answered,rate:answered/starts
    });
    if(answered>=20) {
      const accuracy=solved/answered;
      if(accuracy<=0.2 || accuracy>=0.95)signals.push({
        id:String(q.id),title:String(q.title),kind:"question",
        issue:accuracy<=0.2?"too_hard":"too_easy",plays:starts,completed:answered,rate:accuracy
      });
    }
  }
  return signals.sort((a,b)=>a.rate-b.rate || b.plays-a.plays).slice(0,30);
}
export async function loadAdminContentInsights(f:AnalyticsFilters, risingKind: RisingKind = "pack"){
  // All-time has no preceding equally long comparison: use the last 7 days for trending only.
  const window=f.previousStart?f:resolveAnalyticsFilters({
    period:"7",locale:f.locale,audience:f.audience,mode:f.mode,creator:f.creator
  });
  const compare=window.previousStart!;
  const [p,q,oldP,oldQ]=await Promise.all([
    rows(packSql,params(window,window.start,window.end)),
    rows(questionSql,params(window,window.start,window.end)),
    rows(packSql,params(window,compare,window.start)),
    rows(questionSql,params(window,compare,window.start)),
  ]);
  // Rank each type independently before taking its Top 10; pack members must not crowd out packs.
  const rising = (risingKind === "question" ? risingContent(q,oldQ,"question") : risingContent(p,oldP,"pack"))
    .sort((a,b)=>b.difference-a.difference || b.plays-a.plays).slice(0,10);
  // Quality signals follow the user-selected filter, not the fallback seven-day window.
  const quality = window===f?qualitySignals(p,q) : qualitySignals(
    await rows(packSql,params(f,f.start,f.end)),
    await rows(questionSql,params(f,f.start,f.end)));
  return {rising,quality,trendPeriod:window.period};
}
