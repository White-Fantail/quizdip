import { authPool } from "../../lib/auth";

export type AnalyticsParams = {
  period?: string; start?: string; end?: string; locale?: string;
  audience?: string; mode?: string; creator?: string; sort?: string;
};
export type AnalyticsFilters = {
  period: string; startDay: string; endDay: string; start: Date; end: Date;
  previousStart: Date | null; locale: string; audience: string; mode: string;
  creator: string; sort: string; bucket: "day" | "week" | "month";
};
type Raw = Record<string, unknown>;
export type RankRow = {
  id: string; title: string; plays: number; completed: number;
  solved: number; failed: number; completionRate: number | null;
  accuracy: number | null; previous: number; growth: number | null;
  isKids: boolean; createdAt: Date | null;
};
const tz = "Pacific/Auckland";
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export function localDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const find = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return [find("year"), find("month"), find("day")].join("-");
}
function addDays(day: string, count: number): string {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function midnight(day: string): Date {
  // NZ changes between UTC+12 and UTC+13; never assume a fixed offset.
  const [year, month, date] = day.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, date, 12));
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, timeZoneName: "shortOffset",
  }).formatToParts(noon).find(item => item.type === "timeZoneName")?.value ?? "GMT+13";
  const match = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const minutes = match ? (match[1] === "+" ? 1 : -1) *
    (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 780;
  return new Date(Date.UTC(year, month - 1, date) - minutes * 60000);
}
function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !dayPattern.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function resolveAnalyticsFilters(query: AnalyticsParams, now = new Date()): AnalyticsFilters {
  const today = localDay(now);
  const period = ["today", "yesterday", "7", "30", "90", "all", "custom"].includes(query.period ?? "")
    ? query.period! : "30";
  let startDay = addDays(today, -29), endDay = today;
  if (period === "today") startDay = today;
  if (period === "yesterday") startDay = endDay = addDays(today, -1);
  if (period === "7") startDay = addDays(today, -6);
  if (period === "90") startDay = addDays(today, -89);
  if (period === "all") startDay = "2000-01-01";
  if (period === "custom" && validDay(query.start) && validDay(query.end) &&
      query.start <= query.end && query.end <= today &&
      midnight(query.end).getTime() - midnight(query.start).getTime() <= 366 * 86400000) {
    startDay = query.start;
    endDay = query.end;
  }
  const start = midnight(startDay), end = midnight(addDays(endDay, 1));
  const days = (Date.parse(endDay + "T00:00:00Z") - Date.parse(startDay + "T00:00:00Z")) / 86400000 + 1;
  const previousStart = period === "all" ? null : midnight(addDays(startDay, -days));
  return {
    period, startDay, endDay, start, end, previousStart,
    locale: ["en", "ko"].includes(query.locale ?? "") ? query.locale! : "all",
    audience: ["GENERAL", "KIDS"].includes(query.audience ?? "") ? query.audience! : "all",
    mode: ["PACK", "RANDOM_FIVE", "INFINITE", "DISCOVER"].includes(query.mode ?? "") ? query.mode! : "all",
    creator: (query.creator ?? "").trim().slice(0, 100),
    sort: ["plays", "completion", "accuracy", "growth"].includes(query.sort ?? "") ? query.sort! : "plays",
    bucket: days <= 31 ? "day" : days <= 120 ? "week" : "month",
  };
}

function number(value: unknown): number { return Number(value ?? 0) || 0; }
function ratio(a: number, b: number): number | null { return b ? a / b : null; }
function growth(current: number, previous: number, hasPrevious: boolean): number | null {
  return hasPrevious && previous > 0 ? (current - previous) / previous : null;
}
function runFilters(): string {
  return `r."startedAt" >= $1::timestamptz AND r."startedAt" < $2::timestamptz
    AND ($3::text = 'all' OR r."locale" = $3::text)
    AND ($4::text = 'all' OR ($4::text = 'KIDS' AND (r."lane" = 'KIDS' OR kr."runId" IS NOT NULL))
      OR ($4::text = 'GENERAL' AND r."lane" = 'GENERAL' AND kr."runId" IS NULL))
    AND ($5::text = 'all' OR r."mode" = $5::text)
    AND ($6::text = '' OR pack."authorId" = $6::text OR EXISTS
      (SELECT 1 FROM "PlayRunQuestion" rq JOIN "Quiz" q ON q."id" = rq."quizId"
       WHERE rq."runId" = r."id" AND q."authorId" = $6::text))`;
}
function questionFilters(): string {
  return `s."startedAt" >= $1::timestamptz AND s."startedAt" < $2::timestamptz
    AND ($3::text = 'all' OR s."locale" = $3::text)
    AND ($4::text = 'all' OR ($4::text = 'KIDS' AND (r."lane" = 'KIDS' OR kr."runId" IS NOT NULL OR ks."sessionId" IS NOT NULL))
      OR ($4::text = 'GENERAL' AND ks."sessionId" IS NULL AND kr."runId" IS NULL AND (r."lane" = 'GENERAL' OR r."id" IS NULL)))
    AND ($5::text = 'all' OR ($5::text = 'DISCOVER' AND s."runId" IS NULL) OR r."mode" = $5::text)
    AND ($6::text = '' OR q."authorId" = $6::text)`;
}
const runJoins = `FROM "PlayRun" r
  LEFT JOIN "KidPlayRun" kr ON kr."runId" = r."id"
  LEFT JOIN "QuizPack" pack ON pack."id" = r."packId"`;
const questionJoins = `FROM "PlaySession" s
  JOIN "Quiz" q ON q."id" = s."quizId"
  JOIN "QuizRevision" rev ON rev."id" = s."revisionId"
  LEFT JOIN "PlayRun" r ON r."id" = s."runId"
  LEFT JOIN "KidPlayRun" kr ON kr."runId" = r."id"
  LEFT JOIN "KidPlaySingle" ks ON ks."sessionId" = s."id"`;

async function queryRows(sql: string, params: unknown[]): Promise<Raw[]> {
  return (await authPool().query(sql, params)).rows as Raw[];
}
function values(filters: AnalyticsFilters, start = filters.start, end = filters.end): unknown[] {
  return [start, end, filters.locale, filters.audience, filters.mode, filters.creator];
}
function sortRanks(rows: RankRow[], sort: string): RankRow[] {
  const key = (row: RankRow) => sort === "completion" ? (row.plays >= 5 ? row.completionRate ?? -1 : -1)
    : sort === "accuracy" ? (row.solved + row.failed >= 5 ? row.accuracy ?? -1 : -1)
    : sort === "growth" ? (row.plays >= 5 ? row.growth ?? -1 : -1) : row.plays;
  return rows.sort((a, b) => key(b) - key(a) || b.plays - a.plays).slice(0, 30);
}
function mapRanks(rows: Raw[], oldRows: Raw[], hasPrevious: boolean, isQuestion: boolean, sort: string): RankRow[] {
  const previousById = new Map(oldRows.map(row => [String(row.id), number(row.plays)]));
  return sortRanks(rows.map(row => {
    const plays = number(row.plays), completed = number(row.completed);
    const solved = number(row.solved), failed = number(row.failed);
    const previous = previousById.get(String(row.id)) ?? 0;
    return {
      id: String(row.id), title: String(row.title ?? row.id), plays, completed,
      solved, failed, previous, growth: growth(plays, previous, hasPrevious),
      completionRate: ratio(completed, plays),
      accuracy: ratio(solved, solved + failed), isKids: Boolean(row.is_kids),
      createdAt: row.created_at ? new Date(String(row.created_at)) : null,
    };
  }), sort);
}

export async function loadAdminContentAnalytics(f: AnalyticsFilters) {
  const runSql = `SELECT COUNT(*) AS plays,
    COUNT(*) FILTER (WHERE r."status" = 'FINISHED') AS completed,
    COUNT(DISTINCT CASE WHEN r."userId" IS NOT NULL THEN 'user:' || r."userId"
      WHEN kr."profileId" IS NOT NULL THEN 'kid:' || kr."profileId" END) AS identified,
    COUNT(*) FILTER (WHERE r."userId" IS NULL AND kr."profileId" IS NULL) AS guests
    ${runJoins} WHERE ${runFilters()}`;
  const answerSql = `SELECT COUNT(*) AS exposures,
    COUNT(*) FILTER (WHERE s."status" IN ('SOLVED', 'FAILED')) AS answered,
    COUNT(*) FILTER (WHERE s."status" = 'SOLVED') AS solved,
    COUNT(*) FILTER (WHERE s."status" = 'FAILED') AS failed
    ${questionJoins} WHERE ${questionFilters()}`;
  const trendSql = `SELECT date_trunc($7::text, r."startedAt" AT TIME ZONE 'Pacific/Auckland')::date::text AS bucket,
    COUNT(*) AS plays ${runJoins} WHERE ${runFilters()}
    GROUP BY bucket ORDER BY bucket DESC LIMIT 60`;
  const packSql = `SELECT pack."id", pack."title", pack."createdAt" AS created_at,
    pack."kidsEligible" AS is_kids, COUNT(*) AS plays,
    COUNT(*) FILTER (WHERE r."status" = 'FINISHED') AS completed,
    COALESCE(SUM(r."solved"), 0) AS solved, COALESCE(SUM(r."failed"), 0) AS failed
    ${runJoins} WHERE ${runFilters()} AND r."mode" = 'PACK' AND pack."id" IS NOT NULL
    AND ($6::text = '' OR pack."authorId" = $6::text)
    GROUP BY pack."id" ORDER BY plays DESC LIMIT 500`;
  const questionSql = `SELECT q."id", MAX(rev."title") AS title, q."createdAt" AS created_at,
    q."kidsEligible" AS is_kids, COUNT(*) AS plays,
    COUNT(*) FILTER (WHERE s."status" IN ('SOLVED','FAILED')) AS completed,
    COUNT(*) FILTER (WHERE s."status" = 'SOLVED') AS solved,
    COUNT(*) FILTER (WHERE s."status" = 'FAILED') AS failed
    ${questionJoins} WHERE ${questionFilters()}
    GROUP BY q."id" ORDER BY plays DESC LIMIT 500`;
  const args = values(f);
  const previousArgs = f.previousStart ? values(f, f.previousStart, f.start) : null;
  const requests = [
    queryRows(runSql, args), queryRows(answerSql, args),
    queryRows(trendSql, [...args, f.bucket]),
    queryRows(packSql, args), queryRows(questionSql, args),
    previousArgs ? queryRows(runSql, previousArgs) : Promise.resolve([] as Raw[]),
    previousArgs ? queryRows(answerSql, previousArgs) : Promise.resolve([] as Raw[]),
    previousArgs ? queryRows(packSql, previousArgs) : Promise.resolve([] as Raw[]),
    previousArgs ? queryRows(questionSql, previousArgs) : Promise.resolve([] as Raw[]),
  ] as const;
  const [runs, answers, trend, packs, questions, oldRuns, oldAnswers, oldPacks, oldQuestions] = await Promise.all(requests);
  const r = runs[0] ?? {}, a = answers[0] ?? {};
  const pr = oldRuns[0] ?? {}, pa = oldAnswers[0] ?? {};
  const completed = number(r.completed), plays = number(r.plays);
  const answered = number(a.answered), solved = number(a.solved);
  const oldPlays = number(pr.plays), oldAnswered = number(pa.answered);
  return {
    totals: {
      plays, identifiedPlayers: number(r.identified), guestRuns: number(r.guests),
      completed, completionRate: ratio(completed, plays), exposures: number(a.exposures),
      answered, accuracy: ratio(solved, answered),
      playsChange: growth(plays, oldPlays, !!previousArgs),
      answersChange: growth(answered, oldAnswered, !!previousArgs),
      previousPlays: oldPlays, previousAnswered: oldAnswered,
      previousCompletionRate: ratio(number(pr.completed), oldPlays),
      previousAccuracy: ratio(number(pa.solved), oldAnswered),
    },
    trend: trend.reverse().map(row => ({ day: String(row.bucket), plays: number(row.plays) })),
    packs: mapRanks(packs, oldPacks, !!previousArgs, false, f.sort),
    questions: mapRanks(questions, oldQuestions, !!previousArgs, true, f.sort),
  };
}
