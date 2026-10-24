import { ZodError } from "zod";
import { actorFor, requireSameOrigin, PlatformError } from "../../../../src/modules/platform/auth";
import { hasKidCookie } from "../../../../src/modules/kids/credentials";
import { fail } from "../../../../src/modules/platform/auth";
import { execute } from "../../../../src/modules/platform/operations";
import type { Operation } from "../../../../src/modules/platform/contracts";

export const runtime = "nodejs";
type Context = { params: Promise<{ segments: string[] }> };
type Match = { op: Operation; args: Record<string, unknown> };

function route(method: string, segments: string[]): Match | null {
  const [a, b, c, d, e, f] = segments;
  if (a === "catalog" && method === "GET" && !b) return { op: "catalog", args: {} };
  if (a === "topics" && !b && method === "GET") return { op: "topic_list", args: {} };
  if (a === "quizzes") {
    if (!b && method === "GET") return { op: "quiz_list", args: {} };
    if (!b && method === "POST") return { op: "quiz_create", args: {} };
    if (b && !c && method === "GET") return { op: "quiz_get", args: { id: b } };
    if (b && !c && method === "PATCH") return { op: "quiz_update", args: { id: b } };
    if (b && c === "kids-request" && !d && method === "POST") return {op:"quiz_kids_request",args:{id:b}};
    if (b && c === "review" && method === "GET") return { op: "quiz_review_get", args: { id:b } };
    if (b && c === "review" && method === "POST") return { op: "quiz_review", args: { id:b } };
    if (b && c === "languages" && !d && method === "GET") return {op: "quiz_languages",args:{id:b}};
    if (b && c === "languages" && d && !e && method === "GET") return {op: "quiz_translation_get",args:{id:b,locale:d}};
    if (b && c === "languages" && d && !e && method === "PUT") return {op: "quiz_translation_save",args:{id:b,locale:d}};
    if (b && c === "languages" && d && e === "generate" && !f && method === "POST") return {op: "quiz_translation_generate",args:{id:b,locale:d}};
    if (b && c === "languages" && d && e === "publish" && !f && method === "POST") return {op: "quiz_translation_publish",args:{id:b,locale:d}};
    if (b && c === "languages" && d && e === "hide" && !f && method === "POST") return {op: "quiz_translation_hide",args:{id:b,locale:d}};
    if (b && c === "language" && !d && method === "POST") return { op: "quiz_language_set", args: { id: b } };
    if (b && c === "publish" && method === "POST") return { op: "quiz_publish", args: { id: b } };
    if (b && c === "clues" && method === "PUT") return { op: "clues_replace", args: { id: b } };
    if (b && c === "stats" && method === "GET") return { op: "quiz_stats", args: { quizId: b } };
    if (b && c === "reviews" && method === "GET") return { op: "reviews_list", args: { quizId: b } };
    if (b && c === "reviews" && method === "POST") return { op: "review_upsert", args: { quizId: b } };
    if (b && c === "reviews" && method === "DELETE") return { op: "review_remove", args: { quizId: b } };
    if (b && c === "reports" && method === "POST") return { op: "report_create", args: { quizId: b } };
  }
  if(a==="admin" && b==="moderation"){
    if(c==="queue"&&!d&&method==="GET")return {op:"admin_moderation_queue",args:{}};
    if(c==="appeals"&&!d&&method==="GET")return {op:"admin_moderation_appeals",args:{}};
    if(c==="appeals"&&d&&e==="review"&&!f&&method==="POST")return {op:"admin_moderation_appeal_review",args:{id:d}};
    if(c==="detail"&&d&&e&&!f&&method==="GET")return {op:"admin_moderation_detail",args:{kind:d,id:e}};
    if(c==="policy"&&!d&&method==="GET")return {op:"admin_moderation_policy_get",args:{}};
    if(c==="policy"&&!d&&method==="PATCH")return {op:"admin_moderation_policy_update",args:{}};
    if(c==="review"&&!d&&method==="POST")return {op:"admin_moderation_review",args:{}};
    if(c==="publishers"&&d&&!e&&method==="GET")return {op:"admin_publisher_get",args:{userId:d}};
    if(c==="publishers"&&d&&!e&&method==="POST")return {op:"admin_publisher_set",args:{userId:d}};
  }
  if(a==="admin" && b==="quizzes" && c==="review" && !d && method==="GET")
    return {op:"admin_quiz_review_list",args:{}};
  if(a==="admin" && b==="media" && c==="review" && !d && method==="GET")
    return {op:"admin_media_review_list",args:{}};
  if(a==="discover" && b==="sections" && !c && method==="GET") return {op:"discover_sections",args:{}};
  if(a==="editorial" && !b && method==="GET")return {op:"editorial_features",args:{}};
  if(a==="admin" && b==="features"){
    if(!c&&method==="GET")return {op:"admin_feature_list",args:{}};
    if(!c&&method==="POST")return {op:"admin_feature_create",args:{}};
    if(c==="candidates"&&!d&&method==="GET")return {op:"admin_feature_candidates",args:{}};
    if(c&&!d&&method==="PATCH")return {op:"admin_feature_update",args:{id:c}};
    if(c&&!d&&method==="DELETE")return {op:"admin_feature_remove",args:{id:c}};
  }
  if(a==="admin" && b==="packs" && c==="safety" && !d && method==="GET")
    return {op:"admin_pack_safety_list",args:{}};
  if(a==="admin" && b==="packs" && c==="reports" && !d && method==="GET")
    return {op:"admin_pack_reports_list",args:{}};
  if(a==="admin" && b==="packs" && c && d==="safety-review" && !e && method==="POST")
    return {op:"admin_pack_safety_review",args:{id:c}};

  if(a==="me" && b==="moderation"){
    if(!c && method==="GET")return {op:"my_moderation_inbox",args:{}};
    if(c==="appeals"&&!d&&method==="POST")return {op:"my_moderation_appeal",args:{}};
    if(c==="notices"&&d&&e==="read"&&!f&&method==="POST")return {op:"my_moderation_read",args:{id:d}};
  }
  if(a==="me" && b==="packs" && c && !d && method==="GET")
    return {op:"my_pack_get",args:{id:c}};
  if(a==="me" && b==="packs" && c && d==="insights" && !e && method==="GET")
    return {op:"my_pack_insights",args:{id:c}};
  if (a === "packs" && !b) {
    if (method === "GET") return { op: "pack_list", args: {} };
    if (method === "POST") return { op: "pack_create", args: {} };
  }
  if (a === "packs" && b && !c && method === "GET") return { op: "pack_get", args:{id:b} };
  if (a === "packs" && b && c === "recommendations" && !d && method === "GET") return {op:"pack_recommendations",args:{id:b}};
  if (a === "packs" && b && c === "recommendations" && !d && method === "PUT") return {op:"pack_recommendations_set",args:{id:b}};
  if (a === "runs" && b === "recommendations" && !c && method === "POST") return {op:"pack_recommendation_track",args:{}};
  if (a === "packs" && b && c === "reviews" && !d) {
    if(method==="GET")return {op:"pack_reviews_list",args:{id:b}};
    if(method==="POST")return {op:"pack_review_upsert",args:{id:b}};
    if(method==="DELETE")return {op:"pack_review_remove",args:{id:b}};
  }
  if (a === "packs" && b && c === "reports" && !d && method==="POST")
    return {op:"pack_report_create",args:{id:b}};
  if (a === "packs" && b && c === "preflight" && !d && method === "GET") return { op:"pack_preflight", args:{id:b} };
  if (a === "packs" && b && c === "fun-review" && !d && method === "GET") return { op:"pack_fun_review", args:{id:b} };
  if (a === "packs" && b && c === "publish-preview" && method === "GET") return {op:"pack_publish_preview",args:{id:b}};
  if (a === "packs" && b && c === "publish" && method === "POST") return {op:"pack_publish",args:{id:b}};
  if (a === "packs" && b && c === "kids-request" && !d && method === "POST") return {op:"pack_kids_request",args:{id:b}};
  if (a === "packs" && b && c === "languages" && !d && method === "GET") return { op: "pack_languages", args:{id:b} };
  if (a === "packs" && b && c === "languages" && d && !e && method === "PUT") return { op: "pack_translation_upsert", args:{id:b,locale:d} };
  if (a === "packs" && b && c === "language" && !d && method === "POST") return { op: "pack_language_set", args: { id: b } };
  if (a === "packs" && b && !c && method === "PATCH") return { op: "pack_update", args: { id: b } };
  if (a === "local-play" && b === "single" && c === "start" && method === "POST") return {op:"local_single_start",args:{}};
  if (a === "local-play" && b === "single" && c === "bundle" && method === "POST") return {op:"local_single_bundle",args:{}};
  if (a === "local-play" && b === "single" && c === "sync" && method === "POST") return {op:"local_single_sync",args:{}};
  if (a === "local-play" && b === "single" && c === "media" && method === "POST") return {op:"local_single_media",args:{}};
  if (a === "runs") {
    if (!b && method === "POST") return { op: "run_start", args: {} };
    if (!b && method === "GET") return { op: "run_history", args: {} };
    if (b === "reconcile" && !c && method === "POST") return {op:"run_reconcile",args:{}};
    if (b === "shared" && c && !d && method === "GET") return {op:"run_share_get",args:{shareId:c}};
    if (b && c === "share" && !d && method === "POST") return {op:"run_share",args:{runId:b}};
    if (b && c === "share" && !d && method === "DELETE") return {op:"run_unshare",args:{runId:b}};
    if (b && c === "bundle" && method === "POST") return {op:"local_run_bundle",args:{runId:b}};
    if (b && c === "sync" && method === "POST") return {op:"local_run_sync",args:{runId:b}};
    if (b && c === "chance" && method === "POST") return { op: "run_chance", args: {runId:b} };
    if (b && c === "local-media" && method === "POST") return {op:"local_run_media",args:{runId:b}};
    if (b && c === "current" && method === "POST") return { op: "run_current", args: { runId:b } };
    if (b && c === "finish" && method === "POST") return { op: "run_finish", args: { runId:b } };
    if (b && c === "feedback" && method === "POST") return { op: "run_feedback", args: { runId:b } };
  }
  if (a === "play" && !b && method === "POST") return { op: "play_start", args: {} };
  if (a === "play" && b && c === "clue" && method === "POST") return { op: "play_clue", args: { sessionId: b } };
  if (a === "play" && b && c === "guess" && method === "POST") return { op: "play_guess", args: { sessionId: b } };
  if (a === "play" && b && c === "review" && method === "POST") return { op: "play_review", args: { sessionId: b } };
  if (a === "media") {
    if (!b && method === "GET") return { op: "media_list", args: {} };
    if (b === "upload" && !c && method === "POST") return { op: "media_upload", args: {} };
    if (b === "import" && !c && method === "POST") return { op: "media_import", args: {} };
    if (b && !c && method === "GET") return { op: "media_get", args: { id: b } };
    if (b && !c && method === "PATCH") return { op: "media_update", args: { id: b } };
    if (b && !c && method === "DELETE") return { op: "media_delete", args: { id: b } };
    if (b && c === "chunk" && method === "POST") return { op: "media_chunk", args: { id: b } };
    if (b && c === "complete" && method === "POST") return { op: "media_complete", args: { id: b } };
    if (b && c === "transform" && method === "POST") return { op: "media_transform", args: { id: b } };
    if (b && c === "review" && method === "GET") return { op: "media_review_get", args: { id: b } };
    if (b && c === "review" && method === "POST") return { op: "media_review", args: { id: b } };
  }
  if (a === "play" && b && c === "media" && method === "POST") return { op: "play_media", args: { sessionId: b } };
  if (a === "me" && b === "chances" && !c && method === "GET") return { op:"chance_balance",args:{} };
  if (a === "me" && b === "ranking" && method === "PATCH") return { op: "ranking_optin", args: {} };
  if (a === "me" && b === "locale" && !c && method === "GET") return { op: "locale_get", args: {} };
  if (a === "me" && b === "locale" && !c && method === "PATCH") return { op: "locale_update", args: {} };
  if (a === "admin" && b === "verify-adult" && !c && method === "POST") return { op: "adult_verify", args: {} };
  if (a === "me" && !b && method === "GET") return { op: "me", args: {} };
  if (a === "me" && b === "quizzes" && c && d === "insights" && method === "GET") return { op: "my_quiz_insights", args: { quizId: c } };
  if (a === "me" && b === "quizzes" && !c && method === "GET") return { op: "my_quizzes", args: {} };
  if (a === "me" && b === "stats" && method === "GET") return { op: "my_stats", args: {} };
  if (a === "reports" && b === "mine" && method === "GET") return { op: "reports_mine", args: {} };
  if (a === "leaderboard" && !b && method === "GET") return { op: "leaderboard", args: {} };
  if (a === "users" && b && !c && method === "GET") return { op: "user_get", args: { userId: b } };
  if (a === "users" && b && c === "reviews" && method === "GET") return { op: "creator_reviews_list", args: { userId: b } };
  if (a === "users" && b && c === "reviews" && method === "POST") return { op: "creator_review_upsert", args: { userId: b } };
  return null;
}
export function parseQuery(query: URLSearchParams): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of query) {
    if (["limit", "offset", "version", "rotation"].includes(key)) values[key] = Number(value);
    else if (["mine", "kids", "includeContent", "confirm"].includes(key)) values[key] = value === "true";
    else values[key] = value;
  }
  return values;
}
export async function handle(request: Request, context: Context): Promise<Response> {
  try {
    const { segments } = await context.params;
    const match = route(request.method, segments);
    if (!match) return Response.json({ error: "not_found" }, { status: 404 });
    const url = new URL(request.url);
    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > 1000000) return Response.json({ error: "too_large" }, { status: 413 });
    // DELETE may include sensitive run capabilities in a JSON body; never require
    // guests to put those credentials in URLs or access logs.
    const body = request.method === "GET" ||
      (request.method === "DELETE" && !request.headers.get("content-type")?.includes("application/json"))
      ? parseQuery(url.searchParams) : await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "invalid_body" }, { status: 400 });
    requireSameOrigin(request);
    // A previously locked browser must remain locked until its guardian
    // verifies the PIN on the dedicated retired-device exit page.
    if (hasKidCookie(request.headers.get("cookie")))
      fail(403,"legacy_kid_retired","Guardian PIN unlock is required for this browser");
    const actor = await actorFor(request);
    const result = await execute(match.op, { ...body, ...match.args }, actor);
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlatformError)
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return Response.json({ error: "validation_error", issues: error.issues }, { status: 400 });
    console.error("API request failed", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
