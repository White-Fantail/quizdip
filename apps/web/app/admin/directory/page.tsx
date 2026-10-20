import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ManagementHeader from "../../../src/components/management-header";
import { resolveLocale, localizeHref } from "../../../src/i18n/core";
import { actorFor } from "../../../src/modules/platform/auth";
import { authPool } from "../../../src/lib/auth";
import { db } from "../../../src/modules/platform/db";
import { ATTEMPTED_SESSION_FILTER, ANSWERED_RUN_FILTER, UNANSWERED_RUN_FILTER,
  RUN_IDLE_MS, effectiveRunStatus } from "../../../src/modules/platform/run-lifecycle";

export const dynamic = "force-dynamic";
const LIMIT = 20;
type View = "users" | "packs" | "questions" | "plays";
type Params = { view?: string; q?: string; status?: string; page?: string };
const views: View[] = ["users", "packs", "questions", "plays"];

export default async function AdminDirectory({ searchParams }: { searchParams: Promise<Params> }) {
  const h = await headers(), locale = resolveLocale(h.get("x-quizdip-locale"));
  const tr = (en: string, ko: string) => locale === "ko" ? ko : en;
  const actor = await actorFor(new Request("http://localhost/admin/directory", { headers: h }));
  if (!actor) redirect(localizeHref("/sign-in?callbackURL=%2Fadmin%2Fdirectory", locale));
  if (actor.role !== "ADMIN") notFound();

  const params = await searchParams;
  const view: View = views.includes(params.view as View) ? params.view as View : "users";
  const q = (params.q ?? "").trim().slice(0, 100);
  const allowedStatus = view === "plays" ? ["ACTIVE", "NOT_STARTED", "IDLE", "EXPIRED", "FINISHED"] : ["DRAFT", "PUBLISHED", "HIDDEN"];
  const status = allowedStatus.includes(params.status ?? "") ? params.status! : "";
  const parsedPage = Number(params.page);
  const page = Number.isSafeInteger(parsedPage) ? Math.min(10000, Math.max(1, parsedPage)) : 1;
  const skip = (page - 1) * LIMIT;
  const base = localizeHref("/admin/directory", locale);
  const date = (value: Date) => value.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-NZ");
  const search = { contains: q, mode: "insensitive" as const };
  const viewNames: Record<View, string> = {
    users: tr("Users", "전체 사용자"),
    packs: tr("Quiz packs", "전체 퀴즈팩"),
    questions: tr("Questions", "전체 문제"),
    plays: tr("Play runs", "전체 플레이"),
  };
  function href(v: View, p = 1) {
    const url = new URLSearchParams({ view: v });
    if (v === view) {
      if (q) url.set("q", q);
      if (status) url.set("status", status);
      if (p > 1) url.set("page", String(p));
    }
    return base + "?" + url.toString();
  }

  let total = 0;
  let entries: React.ReactNode = null;
  if (view === "users") {
    // Better Auth is the registration source of truth. A newly registered
    // account may not yet have a QuizDip domain User record or play activity.
    const pattern = "%" + q + "%";
    const [countRows, pageRows] = await Promise.all([
      authPool().query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM "user" WHERE "name" ILIKE $1 OR "id" ILIKE $1',
        [pattern],
      ),
      authPool().query<{ id: string; name: string | null; createdAt: Date }>(
        'SELECT "id", "name", "createdAt" FROM "user" WHERE "name" ILIKE $1 OR "id" ILIKE $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3',
        [pattern, LIMIT, skip],
      ),
    ]);
    total = Number(countRows.rows[0]?.count ?? 0);
    const identities = pageRows.rows;
    const profiles = identities.length ? await db().user.findMany({
      where: { id: { in: identities.map(u => u.id) } },
      select: { id: true, displayName: true, role: true, publishingStatus: true,
        _count: { select: { quizzes: true, packs: true, playRuns: true, sessions: true } } },
    }) : [];
    const profileById = new Map(profiles.map(p => [p.id, p]));
    entries = identities.map(identity => {
      const u = profileById.get(identity.id);
      return <Link className="review-entry" key={identity.id}
        href={localizeHref("/admin/directory/users/" + encodeURIComponent(identity.id), locale)}>
        <span className="review-entry-copy"><strong>{u?.displayName || identity.name || tr("Unnamed account", "이름 없는 계정")}</strong>
          <small>{u?.role ?? "MEMBER"} · {tr("Joined", "가입")} {date(identity.createdAt)} · {u?.publishingStatus ?? "ACTIVE"}</small>
          <small>{tr("Packs", "팩")} {u?._count.packs ?? 0} · {tr("Questions", "문제")} {u?._count.quizzes ?? 0} · {tr("Runs", "플레이")} {u?._count.playRuns ?? 0} · {tr("Question sessions", "문제 풀이 기록")} {u?._count.sessions ?? 0}</small>
        </span><span className="review-entry-right"><span aria-hidden="true">›</span></span>
      </Link>;
    });
  } else if (view === "packs") {
    const where = { ...(q ? { OR: [{ title: search }, { author: { displayName: search } }] } : {}),
      ...(status ? { publication: status } : {}) };
    const [count, rows] = await Promise.all([
      db().quizPack.count({ where }),
      db().quizPack.findMany({
        where, orderBy: { updatedAt: "desc" }, skip, take: LIMIT,
        select: { id: true, title: true, publication: true, safetyStatus: true,
          updatedAt: true, author: { select: { id: true, displayName: true } },
          _count: { select: { items: true, runs: true } } },
      }),
    ]);
    total = count;
    entries = rows.map(p => <div className="review-entry" key={p.id}>
      <span className="review-entry-copy"><strong>{p.title}</strong>
        <small>{p.publication} · {p.safetyStatus} · {tr("Updated", "수정")} {date(p.updatedAt)}</small>
        <small>{tr("Questions", "문제")} {p._count.items} · {tr("Runs", "플레이")} {p._count.runs} · {tr("Creator", "제작자")}: <Link href={localizeHref("/admin/directory/users/" + encodeURIComponent(p.author.id), locale)}>{p.author.displayName}</Link></small>
      </span>
      {p.publication === "PUBLISHED" && <Link className="card-link" href={localizeHref("/packs/" + p.id, locale)}>{tr("Open", "보기")} →</Link>}
    </div>);
  } else if (view === "questions") {
    const where = { ...(q ? { OR: [{ revisions: { some: { title: search } } }, { author: { displayName: search } }] } : {}),
      ...(status ? { publication: status } : {}) };
    const [count, rows] = await Promise.all([
      db().quiz.count({ where }),
      db().quiz.findMany({
        where, orderBy: { updatedAt: "desc" }, skip, take: LIMIT,
        select: { id: true, mode: true, publication: true, safetyStatus: true,
          updatedAt: true, author: { select: { id: true, displayName: true } },
          revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { title: true } },
          _count: { select: { packItems: true, sessions: true } } },
      }),
    ]);
    total = count;
    entries = rows.map(quiz => <div className="review-entry" key={quiz.id}>
      <span className="review-entry-copy"><strong>{quiz.revisions[0]?.title ?? quiz.id}</strong>
        <small>{quiz.publication} · {quiz.safetyStatus} · {quiz.mode} · {tr("Updated", "수정")} {date(quiz.updatedAt)}</small>
        <small>{tr("Packs", "포함된 팩")} {quiz._count.packItems} · {tr("Question sessions", "문제 풀이 기록")} {quiz._count.sessions} · {tr("Creator", "제작자")}: <Link href={localizeHref("/admin/directory/users/" + encodeURIComponent(quiz.author.id), locale)}>{quiz.author.displayName}</Link></small>
      </span>
      <Link className="card-link" href={localizeHref("/admin/quiz-review/" + quiz.id, locale)}>{tr("Inspect", "상세")} →</Link>
    </div>);
  } else {
    const now=new Date(),idleSince=new Date(now.getTime()-RUN_IDLE_MS);
    // Filter by effective state in SQL, *before pagination*. No client-side
    // filtering that could undercount or skip results between pages.
    const stateWhere=status==="FINISHED"?{status:"FINISHED"}:
      status==="EXPIRED"?{OR:[{status:"EXPIRED"},{status:"ACTIVE",expiresAt:{lte:now}}]}:
      status==="ACTIVE"?{status:"ACTIVE",expiresAt:{gt:now},...ANSWERED_RUN_FILTER}:
      status==="NOT_STARTED"?{status:"ACTIVE",expiresAt:{gt:now},startedAt:{gt:idleSince},...UNANSWERED_RUN_FILTER}:
      status==="IDLE"?{status:"ACTIVE",expiresAt:{gt:now},startedAt:{lte:idleSince},...UNANSWERED_RUN_FILTER}:{};
    const where={AND:[
      ...(q?[{OR:[{user:{displayName:search}},{pack:{title:search}}]}]:[]),
      stateWhere
    ]};
    const [count,rows]=await Promise.all([
      db().playRun.count({where}),
      db().playRun.findMany({
        where,orderBy:{startedAt:"desc"},skip,take:LIMIT,
        select:{id:true,mode:true,status:true,currentIndex:true,targetCount:true,
          score:true,solved:true,failed:true,startedAt:true,expiresAt:true,
          sessions:{where:ATTEMPTED_SESSION_FILTER,take:1,select:{id:true}},
          user:{select:{id:true,displayName:true}},
          pack:{select:{title:true}},
          kidOwnership:{select:{runId:true}}}
      })
    ]);
    const stateName:Record<string,string>={
      ACTIVE:tr("In progress","진행 중"),NOT_STARTED:tr("Not started","미시작"),
      IDLE:tr("Idle · resumable","휴면 · 이어하기 가능"),
      EXPIRED:tr("Expired","만료됨"),FINISHED:tr("Finished","완료")
    };
    total=count;
    entries=rows.map(run=>{
      const effective=effectiveRunStatus(run,run.sessions.length>0,now);
      return <div className="review-entry" key={run.id}>
        <span className="review-entry-copy"><strong>{run.pack?.title??run.mode}</strong>
          <small>{stateName[effective]} · {date(run.startedAt)} · {tr("Score","점수")} {run.score} · {run.currentIndex}/{run.targetCount??"?"} · {tr("Solved","정답")} {run.solved} · {tr("Failed","오답")} {run.failed}</small>
          <small>{run.kidOwnership?tr("Kids play","Kids 플레이"):run.user?<Link href={localizeHref("/admin/directory/users/"+encodeURIComponent(run.user.id),locale)}>{run.user.displayName}</Link>:tr("Guest play","비회원 플레이")}</small>
        </span>
      </div>;
    });
  }
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  return <main className="container inner-page management-page">
    <ManagementHeader eyebrow="QUIZDIP ADMIN · DIRECTORY"
      title={tr("Platform directory", "운영 데이터 조회")}
      description={tr("Search users, every registered quiz pack and question, and saved play records.", "전체 사용자·등록된 퀴즈팩·문제·저장된 플레이 기록을 조회합니다.")}/>
    <div className="actions"><Link className="card-link" href={localizeHref("/admin", locale)}>← {tr("Admin home", "관리자 홈")}</Link></div>
    <nav className="actions" aria-label={tr("Directory sections", "조회 분류")}>
      {views.map(v => <Link key={v} href={href(v)} aria-current={view === v ? "page" : undefined}
        className={view === v ? "btn btn-primary" : "btn btn-outline"}>{viewNames[v]}</Link>)}
    </nav>
    <section className="section review-console">
      <div className="review-section-heading"><h2>{viewNames[view]}</h2><span className="small-tag">{total} {tr("results", "개")}</span></div>
      <form className="review-list-controls" action={base} method="GET">
        <input type="hidden" name="view" value={view}/>
        <label className="review-search-label">{tr("Search", "검색")}
          <input type="search" name="q" defaultValue={q} maxLength={100} placeholder={view === "users" ? tr("Name or user ID", "이름 또는 사용자 ID") : view === "questions" ? tr("Question title or creator", "문제 제목 또는 제작자") : view === "packs" ? tr("Pack title or creator", "팩 제목 또는 제작자") : tr("Creator or pack title", "사용자 또는 팩 제목")}/>
        </label>
        {view !== "users" && <label className="review-filter-label">{tr("Status", "상태")}
          <select name="status" defaultValue={status}><option value="">{tr("All", "전체")}</option>
            {(view === "plays" ? ["ACTIVE", "NOT_STARTED", "IDLE", "EXPIRED", "FINISHED"] : ["DRAFT", "PUBLISHED", "HIDDEN"]).map(v => <option value={v} key={v}>{
              view === "plays" ? ({
                ACTIVE:tr("In progress","진행 중"),NOT_STARTED:tr("Not started","미시작"),
                IDLE:tr("Idle","휴면"),EXPIRED:tr("Expired","만료"),FINISHED:tr("Finished","완료")
              } as Record<string,string>)[v] : v
            }</option>)}
          </select>
        </label>}
        <button type="submit" className="btn btn-outline">{tr("Apply", "조회")}</button>
      </form>
      <div className="review-result-list">{entries}</div>
      {total === 0 && <p className="muted">{tr("No matching records.", "해당하는 기록이 없습니다.")}</p>}
      {pages > 1 && <nav className="review-pagination" aria-label={tr("Pages", "페이지")}>
        {page > 1 ? <Link className="btn btn-outline" href={href(view, page - 1)}>{tr("Previous", "이전")}</Link> : <span/>}
        <span>{page} / {pages}</span>
        {page < pages ? <Link className="btn btn-outline" href={href(view, page + 1)}>{tr("Next", "다음")}</Link> : <span/>}
      </nav>}
    </section>
  </main>;
}
