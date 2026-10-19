import { z } from "zod";

export const uuid = z.string().uuid();
export const userId = z.string().min(8).max(200).regex(/^[a-zA-Z0-9_-]+$/);
const answerTextKey = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export const answerSchema = z.object({
  canonical: z.string().trim().min(1).max(200),
  aliases: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  responseMode: z.enum(["text", "multiple-choice"]).optional(),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(6).optional()
}).superRefine((answer, ctx) => {
  if (answer.responseMode !== "multiple-choice") {
    if (answer.options !== undefined) ctx.addIssue({code:"custom",path:["options"],message:"Only multiple-choice questions can specify options"});
    return;
  }
  if (!answer.options) {
    ctx.addIssue({code:"custom",path:["options"],message:"Multiple-choice questions need 2 to 6 options"});
    return;
  }
  const keys = answer.options.map(answerTextKey);
  if (new Set(keys).size !== keys.length)
    ctx.addIssue({code:"custom",path:["options"],message:"Answer choices must be distinct"});
  if (keys.filter(value => value === answerTextKey(answer.canonical)).length !== 1)
    ctx.addIssue({code:"custom",path:["options"],message:"Include the canonical correct answer exactly once"});
  const aliases = new Set(answer.aliases.map(answerTextKey));
  if (keys.some(value => value !== answerTextKey(answer.canonical) && aliases.has(value)))
    ctx.addIssue({code:"custom",path:["options"],message:"Incorrect options cannot be accepted answer aliases"});
});
const mediaId = uuid;
export const clueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(3000) }),
  z.object({ type: z.enum(["image", "audio", "video"]), mediaId, text: z.string().max(1000).optional() }),
  z.object({ type: z.literal("image-reveal"), mediaId, text: z.string().max(1000).optional(),
    reveal: z.object({effect:z.enum(["zoom","spotlight"]),
      strength:z.number().int().min(0).max(100),
      focusX:z.number().min(0).max(100).default(50),
      focusY:z.number().min(0).max(100).default(50)}) }),
  z.object({ type: z.literal("map"), map: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), zoom: z.number().min(1).max(20).optional() }), text: z.string().max(1000).optional() })
]);
export const translationFields = z.object({
  title:z.string().trim().min(1).max(180),prompt:z.string().trim().min(1).max(2000),
  answer:answerSchema,clues:z.array(clueSchema).max(15),
  explanation:z.string().trim().max(4000).default("")
}).superRefine((quiz,ctx)=>{
  if(!quiz.clues.length&&quiz.answer.responseMode!=="multiple-choice")
    ctx.addIssue({code:"custom",path:["clues"],message:"Text-answer translations require at least one clue"});
});
export type TranslationFields = z.infer<typeof translationFields>;
const mediaMetadata = {
  alt: z.string().max(500).optional(),
  transcript: z.string().max(5000).optional(),
  attribution: z.string().max(500).optional(),
  license: z.string().max(200).optional()
};
const mediaKinds = z.enum(["image", "audio", "video"]);
const mediaFormats = z.enum(["image/jpeg","image/png","image/webp","audio/mpeg","audio/wav","audio/ogg","video/mp4","video/webm"]);
export const gameModeSchema = z.enum(["progressive-clues"]);
export const answerTypeSchema = z.enum(["person","animal","place","thing","event","concept","other"]);
const ageRangeSchema = z.object({
  minimum: z.number().int().min(0).max(120).optional(),
  maximum: z.number().int().min(0).max(120).optional()
}).refine(v=>v.minimum===undefined||v.maximum===undefined||v.minimum<=v.maximum,"Minimum age exceeds maximum");
const topicName = z.string().trim().min(1).max(80);
const topicInputSchema = z.union([topicName, z.object({name:topicName,isSpoiler:z.boolean().optional()})]);
export const quizFields = z.object({
  title: z.string().trim().min(1).max(180), prompt: z.string().trim().min(1).max(2000),
  locale: z.enum(["en", "ko", "und"]).optional(),
  mode: gameModeSchema.default("progressive-clues"),
  answerType: answerTypeSchema.default("other"),
  answer: answerSchema, clues: z.array(clueSchema).max(15),
  explanation: z.string().trim().max(4000).default(""),
  promptMediaIds: z.array(mediaId).max(5).default([]),
  topics: z.array(topicInputSchema).max(12).optional(),
  recommendedAudience: z.object({ ageRange: ageRangeSchema.optional(), difficulty: z.enum(["easy","medium","hard"]).optional() }).optional(),
  creatorIntent: z.object({ ageRange: ageRangeSchema.optional(), note: z.string().max(400).optional() }).optional(),
  kidsRequested: z.boolean().optional()
});
export const packSectionsSchema = z.array(z.object({
  start:z.number().int().min(1).max(100),
  title:z.string().trim().min(1).max(120),
  description:z.string().trim().max(500).default(""),
  mediaId:uuid.nullable().optional()
})).max(30);
/** Localized part text follows the original part boundaries; media and ordering remain source-owned. */
export const translatedPackSectionsSchema=z.array(z.object({
  start:z.number().int().min(1).max(100),
  title:z.string().trim().min(1).max(120),
  description:z.string().trim().max(500).default("")
}).strict()).max(30);
export const scoreReviewsSchema=z.array(z.object({
  minimumScore:z.number().int().min(0).max(10000),
  title:z.string().trim().min(1).max(120),
  description:z.string().trim().max(1500).default("")
})).max(20);
const localeCode = z.enum(["en", "ko"]);
const optionalLocale = localeCode.default("en");
const paging = { limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) };
const session = { sessionId: uuid, sessionToken: z.string().min(32).max(200) };
export const operations = {
  catalog: { public: true, description: "Supported game modes, authoring and a shared non-blocking five-criterion fun rubric (100 editorial points). Read funQuality before creating quizzes or packs.", schema: z.object({}) },
  topic_list: { public: true, description: "Search established topics for discovery and authoring. New topic names are accepted on quiz creation.", schema: z.object({ ...paging, q: topicName.optional(), locale: optionalLocale, kids: z.boolean().default(false) }) },
  quiz_list: { public: true, description: "Find quizzes by game mode, answer kind and topic", schema: z.object({ ...paging, mine: z.boolean().default(false), kids: z.boolean().default(false), locale: optionalLocale, mode: gameModeSchema.optional(), answerType: answerTypeSchema.optional(), topic: topicName.optional() }) },
  quiz_get: { public: true, description: "Get published quiz metadata or my full editable quiz", schema: z.object({ id: uuid, locale: optionalLocale }) },
  quiz_create: { public: false, description: "Create a quiz with optional post-answer explanation. Multiple-choice may have zero clues; text answers need at least one clue. Infer answerType, topics and difficulty; platform safety is not creator input. For every quiz apply quizdip_catalog.funQuality: curiosity, factual surprise, fair choices/clues, pacing, satisfying explanation.", schema: quizFields.superRefine((quiz,ctx)=>{
    if(!quiz.clues.length && quiz.answer.responseMode!=="multiple-choice")
      ctx.addIssue({code:"custom",path:["clues"],message:"Text-answer questions require at least one clue"});
  }) },
  quiz_update: { public: false, description: "Edit quiz content, optional answer explanation or clues as a new immutable revision; multiple-choice may have zero clues. Apply quizdip_catalog.funQuality editorial checklist.", schema: quizFields.partial().extend({ id: uuid, expectedVersion: z.number().int().positive() }) },
  clues_replace: { public: false, description: "Replace clues; multiple-choice may have zero clues, text-answer quizzes require at least one. Creates a new revision", schema: z.object({ id: uuid, expectedVersion: z.number().int().positive(), clues: quizFields.shape.clues }) },
  quiz_languages: { public:false, description:"List owned quiz language versions and unpublished changes", schema:z.object({id:uuid,includeContent:z.boolean().default(false)}) },
  quiz_translation_get: { public:false, description:"Get one owned localized editable revision", schema:z.object({id:uuid,locale: z.enum(["en","ko"])}) },
  quiz_translation_generate: { public:false, description:"Generate optional AI-translated draft suggestion, without saving or publishing", schema:z.object({id:uuid,locale:z.enum(["en","ko"])}) },
  quiz_translation_save: { public:false, description:"Save a manually reviewed translated draft as independent immutable revision", schema:z.object({id:uuid,locale:z.enum(["en","ko"]),sourceRevisionId:uuid,expectedVersion:z.number().int().min(0),fields:translationFields}) },
  quiz_translation_publish: { public:false, description:"Publish a reviewed translated revision without changing source; resets global safety review", schema:z.object({id:uuid,locale:z.enum(["en","ko"]),expectedVersion:z.number().int().positive(),reviewed:z.literal(true),confirm:z.literal(true)}) },
  quiz_translation_hide: { public:false, description:"Hide a non-source translation with explicit confirmation", schema:z.object({id:uuid,locale:z.enum(["en","ko"]),confirm:z.literal(true)}) },
  quiz_language_set: { public: false, description: "Confirm the original language of a legacy unclassified quiz without translating it", schema: z.object({ id: uuid, locale: localeCode, confirm: z.literal(true) }) },
  quiz_publish: { public: false, description: "Publish my quiz; explicit user confirmation needed", schema: z.object({ id: uuid, confirm: z.literal(true) }) },
  quiz_kids_request: { public:false, description:"Creator requests or withdraws Kids review without granting approval",schema:z.object({id:uuid,requested:z.boolean()}) },
  my_moderation_inbox: {public:false,description:"Creator: private moderation notices, account status, and appeals",schema:z.object(paging)},
  my_moderation_read: {public:false,description:"Creator: mark one of my private moderation notices as read",schema:z.object({id:uuid})},
  my_moderation_appeal: {public:false,description:"Creator: request staff review of held content or publishing restriction",schema:z.object({
    kind:z.enum(["QUIZ","PACK","PUBLISHER"]),targetId:z.union([uuid,userId]),
    message:z.string().trim().min(15).max(2000),confirm:z.literal(true)
  })},
  admin_moderation_detail: {public:false,description:"ADMIN: inspect full report reasons, audit history and appeals",schema:z.object({kind:z.enum(["QUIZ","PACK"]),id:uuid})},
  admin_moderation_appeals: {public:false,description:"ADMIN: review pending and resolved creator appeals",schema:z.object({
    ...paging,status:z.enum(["OPEN","ACCEPTED","REJECTED","ALL"]).default("OPEN")
  })},
  admin_moderation_appeal_review: {public:false,description:"ADMIN: accept or reject a moderation appeal with a reason",schema:z.object({
    id:uuid,decision:z.enum(["ACCEPTED","REJECTED"]),reason:z.string().trim().min(5).max(1000),confirm:z.literal(true)
  })},
  admin_moderation_policy_get: {public:false,description:"ADMIN: read configurable non-AI report-hold policy",schema:z.object({})},
  admin_moderation_policy_update: {public:false,description:"ADMIN: change report thresholds and anti-brigading safeguards",schema:z.object({
    enabled:z.boolean(),quizReportThreshold:z.number().int().min(2).max(100),
    packReportThreshold:z.number().int().min(2).max(100),
    windowHours:z.number().int().min(1).max(720),
    minimumEstablishedReporters:z.number().int().min(0).max(100),
    establishedAccountDays:z.number().int().min(0).max(90),confirm:z.literal(true)
  }).refine(p=>p.minimumEstablishedReporters<=Math.min(p.quizReportThreshold,p.packReportThreshold),
    {path:["minimumEstablishedReporters"],message:"Cannot exceed either report threshold"})},
  admin_moderation_queue: {public:false,description:"ADMIN: queue of held/reported quizzes and packs",schema:z.object({limit:z.number().int().min(1).max(100).default(50)})},
  admin_moderation_review: {public:false,description:"ADMIN: clear, staff-restrict or restore published quizzes and packs",schema:z.object({
    kind:z.enum(["QUIZ","PACK"]),id:uuid,decision:z.enum(["CLEARED","RESTRICTED","RESTORED"]),
    reason:z.string().trim().max(1000).default(""),confirm:z.literal(true)
  }).refine(p=>p.decision!=="RESTRICTED"||p.reason.length>=5,
    {path:["reason"],message:"A restriction requires a reason"})},
  admin_publisher_get: {public:false,description:"ADMIN: review a creator's current publication access",schema:z.object({userId})},
  admin_publisher_set: {public:false,description:"ADMIN: restrict or restore creator publication across REST, Studio and MCP",schema:z.object({
    userId,status:z.enum(["ACTIVE","RESTRICTED"]),until:z.iso.datetime().nullable().optional(),
    reason:z.string().trim().max(1000).default(""),confirm:z.literal(true)
  }).refine(p=>p.status!=="RESTRICTED"||p.reason.length>=5,
    {path:["reason"],message:"An account restriction requires a reason"})},
  admin_quiz_review_list: { public:false,description:"ADMIN: flagged reports, negative feedback, requested Kids reviews and restrictions",schema:z.object({
    ...paging,search:z.string().trim().max(120).default(""),
    queue:z.enum(["ATTENTION","REPORTS","RATINGS","KIDS","RESTRICTED","ALL"]).default("ATTENTION")
  }) },
  quiz_review_get: { public:false,description:"ADMIN: inspect a quiz and safety reports",schema:z.object({id:uuid}) },
  quiz_review: { public:false,description:"ADMIN: clear alert, review requested Kids content, restrict or restore",schema:z.object({
    id:uuid,verdict:z.enum(["CLEARED","KIDS_APPROVED","KIDS_REJECTED","RESTRICTED","RESTORED"]),
    reason:z.string().trim().max(1000).default(""),confirm:z.literal(true)
  }).refine(p=>!["RESTRICTED","KIDS_REJECTED"].includes(p.verdict)||p.reason.length>=5,{
    path:["reason"],message:"Restrictions and Kids rejections require at least 5 characters"
  }) },
  pack_languages: { public:false, description:"List owned pack localization including chapter, ending and score-band translations and question-language coverage", schema:z.object({id:uuid}) },
  pack_translation_upsert: { public:false, description:"Save/publish full pack translation: title, description, chapter text, ending, and score bands; preserves source media and thresholds", schema:z.object({id:uuid,locale:localeCode,title:z.string().trim().min(1).max(180),description:z.string().max(2000).default(""),sections:translatedPackSectionsSchema.optional(),closingMessage:z.string().trim().max(4000).optional(),scoreReviews:scoreReviewsSchema.optional(),status:z.enum(["DRAFT","PUBLISHED","HIDDEN"]).default("DRAFT"),confirm:z.boolean().default(false)}) },
  pack_language_set: { public: false, description: "Confirm original language of an unclassified legacy pack", schema: z.object({ id: uuid, locale: localeCode, confirm: z.literal(true) }) },
  pack_get: { public:true, description:"Get a published localized quiz pack without revealing answers", schema:z.object({id:uuid,locale:optionalLocale}) },
  my_pack_get: { public:false, description:"Get the complete editable metadata and ordered questions of my pack", schema:z.object({id:uuid}) },
  pack_list: { public: true, description: "List published packs or my packs", schema: z.object({ ...paging, mine: z.boolean().default(false), locale: optionalLocale }) },
  pack_preflight: { public:false, description:"Check my pack readiness and quota plus automatic non-blocking editorial fun diagnostics without publishing", schema:z.object({id:uuid}) },
  pack_fun_review: { public:false, description:"Automatically inspect my pack against QuizDip\'s five-criterion 100-point editorial fun rubric. Returns objective signals and actionable suggestions, NOT a fabricated subjective score; does not publish or restrict content.", schema:z.object({id:uuid}) },
  pack_create: { public: false, description: "Create an ordered quiz pack with optional cover image, titled chapter transitions (section descriptions/images), closing message and total-score commentary. Apply quizdip_catalog.funQuality; response includes automatic fun review (advisory only).", schema: z.object({ title: z.string().min(1).max(180), description: z.string().max(2000).default(""), coverMediaId:uuid.nullable().optional(), sections:packSectionsSchema.default([]), closingMessage:z.string().trim().max(4000).default(""), scoreReviews:scoreReviewsSchema.default([]), quizIds: z.array(uuid).min(1).max(100), orderMode:z.enum(["CREATOR","RANDOM"]).default("CREATOR"), locale: z.enum(["en", "ko", "und"]).default("und") }) },
  pack_publish_preview: { public:false, description:"Validate owned pack and draft questions, including non-blocking fun review, without changing publication", schema:z.object({id:uuid}) },
  pack_publish: { public:false, description:"Confirm atomic publication of pack and eligible owned drafts. Review pack_publish_preview funReview before publishing; fun advice is never a publication gate.", schema:z.object({id:uuid,confirm:z.literal(true)}) },
  pack_kids_request: { public:false, description:"Request Kids review for my fully approved published original-language quiz pack", schema:z.object({id:uuid,confirm:z.literal(true)}) },
  pack_reviews_list: { public:true, description:"Read independent public quiz pack feedback", schema:z.object({id:uuid,locale:optionalLocale,...paging}) },
  pack_review_upsert: { public:false, description:"Rate a full quiz pack after verified completion", schema:z.object({id:uuid,locale:optionalLocale,rating:z.union([z.literal(-1),z.literal(1)]),comment:z.string().max(2000).default("")}) },
  pack_review_remove: { public:false, description:"Remove my quiz pack reaction", schema:z.object({id:uuid,locale:optionalLocale}) },
  pack_report_create: { public:false, description:"Report a quality or safety problem with an entire pack", schema:z.object({id:uuid,locale:optionalLocale,reason:z.enum(["WRONG_ANSWER","WRONG_CLUE","UNSAFE","COPYRIGHT","PRIVACY","SPAM","DUPLICATE"]),detail:z.string().trim().min(5).max(2000)}) },
  my_pack_insights: { public:false, description:"Aggregate owner-only pack completion and feedback insights", schema:z.object({id:uuid,locale:z.enum(["en","ko","all"]).default("all")}) },
  editorial_features: { public:true, description:"Read explicitly labeled active general editorial picks, after live safety validation", schema:z.object({locale:optionalLocale,lane:z.literal("GENERAL").default("GENERAL"),limit:z.number().int().min(1).max(20).default(10)}) },
  admin_feature_list: { public:false, description:"ADMIN: list planned, paused and live editorial placements", schema:z.object({...paging,locale:localeCode.optional(),lane:z.enum(["GENERAL","KIDS"]).optional(),status:z.enum(["ACTIVE","PAUSED"]).optional()}) },
  admin_feature_candidates: { public:false, description:"ADMIN: discover eligible quizzes or packs for manual highlighting", schema:z.object({type:z.enum(["QUIZ","PACK"]),locale:optionalLocale,lane:z.enum(["GENERAL","KIDS"]).default("GENERAL"),search:z.string().trim().max(100).default(""),limit:z.number().int().min(1).max(20).default(12)}) },
  admin_feature_create: { public:false, description:"ADMIN: explicitly schedule an editorial quiz/pack placement", schema:z.object({
    targetType:z.enum(["QUIZ","PACK"]),targetId:uuid,locale:optionalLocale,
    lane:z.enum(["GENERAL","KIDS"]).default("GENERAL"),placement:z.enum(["HERO","ROW"]).default("ROW"),
    priority:z.number().int().min(-100).max(100).default(0),
    headline:z.string().trim().max(180).default(""),description:z.string().trim().max(500).default(""),
    startAt:z.iso.datetime(),endAt:z.iso.datetime(),confirm:z.literal(true)
  }) },
  admin_feature_update: { public:false, description:"ADMIN: pause, reschedule, relabel or reorder an audited feature", schema:z.object({
    id:uuid,status:z.enum(["ACTIVE","PAUSED"]).optional(),placement:z.enum(["HERO","ROW"]).optional(),
    priority:z.number().int().min(-100).max(100).optional(),
    headline:z.string().trim().max(180).optional(),description:z.string().trim().max(500).optional(),
    startAt:z.iso.datetime().optional(),endAt:z.iso.datetime().optional(),confirm:z.literal(true)
  }) },
  admin_feature_remove: { public:false, description:"ADMIN: explicitly remove an audited editorial placement", schema:z.object({id:uuid,confirm:z.literal(true)}) },
  admin_pack_safety_list: { public:false, description:"ADMIN: review only creator-requested Kids pack safety applications", schema:z.object(paging) },
  admin_pack_reports_list: { public:false, description:"ADMIN: inspect flagged quiz packs requiring content moderation", schema:z.object(paging) },
  admin_pack_safety_review: { public:false, description:"ADMIN: independently approve, hold or restrict a pack for Kids", schema:z.object({
    id:uuid,expectedVersion:z.number().int().positive(),verdict:z.enum(["APPROVED","REJECTED","RESTRICTED","RESTORED"]),
    reason:z.string().trim().max(1000).default(""),confirm:z.literal(true)
  }).refine(p=>!["RESTRICTED","REJECTED"].includes(p.verdict)||p.reason.length>=8,{
    path:["reason"],message:"A pack restriction or Kids rejection requires a reason of at least 8 characters"
  }) },
  discover_sections: { public:true, description:"Explore organic trending, popular, rated, difficult and new quiz/pack content", schema:z.object({locale:optionalLocale}) },
  pack_update: { public: false, description: "Edit quiz pack questions and optional coverMediaId, sections, closingMessage or scoreReviews; or change publication status. Apply quizdip_catalog.funQuality and inspect returned non-blocking funReview.", schema: z.object({ id: uuid, title: z.string().min(1).max(180).optional(), description: z.string().max(2000).optional(), coverMediaId:uuid.nullable().optional(), sections:packSectionsSchema.optional(), closingMessage:z.string().trim().max(4000).optional(), scoreReviews:scoreReviewsSchema.optional(), quizIds: z.array(uuid).min(1).max(100).optional(), orderMode:z.enum(["CREATOR","RANDOM"]).optional(), publication: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]).optional(), confirm: z.boolean().optional() }) },
  play_start: { public: true, description: "Start a playable session and see first clue", schema: z.object({ quizId: uuid, kids: z.boolean().default(false), locale: optionalLocale }) },
  play_clue: { public: true, description: "Reveal the next clue using my play token", schema: z.object(session) },
  play_guess: { public: true, description: "Check my guess on the server", schema: z.object({ ...session, guess: z.string().trim().min(1).max(200) }) },
  play_review: { public: true, description: "Read remaining pinned clues only after my session finishes (signed session token required)", schema: z.object(session) },
  reviews_list: { public: true, description: "Read public quiz reviews", schema: z.object({ quizId: uuid, locale: optionalLocale, kind: z.enum(["QUIZ","TRANSLATION"]).default("QUIZ"), ...paging }) },
  review_upsert: { public: false, description: "Rate and review a completed quiz", schema: z.object({ quizId: uuid, locale: optionalLocale, kind: z.enum(["QUIZ","TRANSLATION"]).default("QUIZ"), rating: z.union([z.literal(-1), z.literal(1)]), comment: z.string().max(2000).default("") }) },
  review_remove: { public: false, description: "Remove my own quiz reaction", schema: z.object({quizId:uuid,locale:optionalLocale,kind:z.enum(["QUIZ","TRANSLATION"]).default("QUIZ")}) },
  report_create: { public: false, description: "Report a quiz issue", schema: z.object({ quizId: uuid, locale: optionalLocale, reason: z.enum(["WRONG_ANSWER", "WRONG_CLUE", "UNSAFE", "COPYRIGHT", "PRIVACY", "SPAM", "DUPLICATE"]), detail: z.string().trim().min(5).max(2000) }) },
  reports_mine: { public: false, description: "Track reports I submitted", schema: z.object(paging) },
  quiz_stats: { public: true, description: "Success rate, revision metrics, reviews and per-clue stages", schema: z.object({ quizId: uuid, locale: optionalLocale, version: z.number().int().positive().optional() }) },
  me: { public: false, description: "My verified account and settings", schema: z.object({}) },
  locale_get: { public: false, description: "Read my UI and content language preferences", schema: z.object({}) },
  locale_update: { public: false, description: "Set my UI and content language together", schema: z.object({ locale: z.enum(["en", "ko"]) }) },
  my_quizzes: { public: false, description: "Search, filter and paginate only my authored quizzes. Returns total count and lightweight feedback totals.", schema: z.object({
    ...paging, search: z.string().trim().max(120).default(""),
    publication: z.enum(["all","DRAFT","PUBLISHED","HIDDEN"]).default("all"),
    safety: z.enum(["all","ACTIVE","UNDER_REVIEW","RESTRICTED"]).default("all"),
    sort: z.enum(["newest","oldest"]).default("newest")
  }) },
  my_quiz_insights: { public: false, description: "Private owner-only play results, rating summary, anonymized report counts and paginated quiz feedback across revisions", schema: z.object({ quizId: uuid, locale: z.enum(["en","ko","und","all"]).default("all"), ...paging }) },
  my_stats: { public: false, description: "My private all-time and UTC day/week/month play stats and eligible ranks", schema: z.object({}) },
  leaderboard: { public: true, description: "UTC daily, weekly, monthly and all-time opt-in verified adult rankings by solved, detective, challenge, explorer or rising", schema: z.object({
    ...paging,quizId:uuid.optional(),period:z.enum(["day","week","month","all"]).default("all"),
    category:z.enum(["solved","detective","challenge","explorer","rising"]).default("solved")
  }) },
  user_get: { public: true, description: "View a creator's public profile and reputation", schema: z.object({ userId }) },
  creator_reviews_list: { public: true, description: "Read the public reviews of a quiz creator", schema: z.object({ userId, ...paging }) },
  creator_review_upsert: { public: false, description: "Rate a creator after finishing one of their questions", schema: z.object({ userId, rating: z.union([z.literal(-1), z.literal(1)]), comment: z.string().max(2000).default("") }) },
  media_upload: { public: false, description: "Reserve private object storage and return a short-lived signed upload URL", schema: z.object({
    kind: mediaKinds, mimeType: mediaFormats, filename: z.string().min(1).max(200), sizeBytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), ...mediaMetadata
  }) },
  media_chunk: { public: false, description: "Upload a 512 KiB base64 chunk through MCP when direct binary PUT is unavailable", schema: z.object({
    id: mediaId, index: z.number().int().min(0).max(127),
    dataBase64: z.string().min(4).max(720000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)
  }) },
  media_complete: { public: false, description: "Verify uploaded bytes or sequential MCP chunks and finalize immutable media", schema: z.object({
    id: mediaId, partCount: z.number().int().min(1).max(128).optional()
  }) },
  media_import: { public: false, description: "Import HTTPS media from a server-approved host into private storage", schema: z.object({
    url: z.url().max(2000).refine(value => {
      try {
        const source = new URL(value);
        return source.protocol === "https:" && !source.username && !source.password &&
          (!source.port || source.port === "443");
      } catch { return false; }
    }, { message: "Import requires a direct HTTPS URL without credentials or custom ports" }),
    kind: mediaKinds, filename: z.string().min(1).max(200), ...mediaMetadata
  }) },
  media_list: { public: false, description: "Search and paginate my media, including optional usage filtering", schema: z.object({
    ...paging, search: z.string().trim().max(120).default(""),
    kind: z.enum(["all", "image", "audio", "video"]).default("all"),
    moderation: z.enum(["all", "PENDING", "APPROVED", "RESTRICTED"]).default("all"),
    status: z.enum(["all", "READY", "UPLOADING"]).default("all"),
    usage: z.enum(["all", "used", "unused"]).default("all"),
    sort: z.enum(["newest", "oldest", "name", "size"]).default("newest"),
  }) },
  media_get: { public: false, description: "Get a media asset, owner preview, thumbnail and quiz usage", schema: z.object({ id: mediaId, purpose: z.enum(["detail", "thumbnail"]).default("detail") }) },
  media_update: { public: false, description: "Edit attribution or accessible text of my media; normal edits reset moderation", schema: z.object({ id: mediaId, ...mediaMetadata }) },
  media_delete: { public: false, description: "Delete media not needed by current revisions or unexpired plays; keep historical revision records; requires confirmation", schema: z.object({ id: mediaId, confirm: z.literal(true) }) },
  media_transform: { public: false, description: "Create an immutable derived image crop or resized variant", schema: z.object({
    id: mediaId, crop: z.object({ left: z.number().int().min(0), top: z.number().int().min(0),
      width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
    resizeWidth: z.number().int().min(64).max(2048).optional()
  }).strict().refine(p => !!(p.crop || p.resizeWidth), { message: "Choose at least one image transform" }) },
  admin_media_review_list: { public:false, description:"ADMIN ONLY: paginate ready media pending review and previously moderated media", schema:z.object({
    ...paging, search:z.string().trim().max(120).default(""),
    kind:z.enum(["all","image","audio","video"]).default("all"),
    moderation:z.enum(["all","PENDING","APPROVED","RESTRICTED"]).default("PENDING")
  }) },
  media_review_get: { public: false, description: "ADMIN ONLY: inspect private media and credits before moderation", schema: z.object({id:mediaId}) },
  media_review: { public: false, description: "ADMIN ONLY: explicitly approve or restrict validated media", schema: z.object({
    id: mediaId, verdict: z.enum(["APPROVED", "RESTRICTED"]), confirm: z.literal(true),
    reason: z.string().trim().max(1000).default("")
  }).refine(p=>p.verdict!=="RESTRICTED"||p.reason.length>=5,{
    path:["reason"],message:"A media restriction requires a reason of at least 5 characters"
  }) },
  play_media: { public: true, description: "Renew signed playback URL for revealed or completed-round review media", schema: z.object({
    ...session, mediaId
  }) },
  local_run_bundle: {public:true,description:"Download full pinned run questions, clues and answer keys for local play",schema:z.object({
    runId:uuid,runToken:z.string().min(32).max(200)
  })},
  local_run_sync: {public:true,description:"Store locally completed run rounds idempotently",schema:z.object({
    runId:uuid,runToken:z.string().min(32).max(200),results:z.array(z.object({
      position:z.number().int().min(0).max(10000),cluesUsed:z.number().int().min(0).max(15),
      status:z.enum(["SOLVED","FAILED"]),score:z.number().int().min(0).max(125),hadWrongGuess:z.boolean().optional()
    })).max(100)
  })},
  local_run_media: {public:true,description:"Get a short-lived URL for media in my downloaded run",schema:z.object({
    runId:uuid,runToken:z.string().min(32).max(200),
    position:z.number().int().min(0).max(10000),mediaId
  })},
  local_single_start: {public:true,description:"Start a complete single question for local play",schema:z.object({
    quizId:uuid,locale:optionalLocale,kids:z.boolean().default(false)
  })},
  local_single_bundle: {public:true,description:"Resume a downloaded single question",schema:z.object({...session})},
  local_single_sync: {public:true,description:"Store a locally completed single question",schema:z.object({
    ...session,cluesUsed:z.number().int().min(0).max(15),
    status:z.enum(["SOLVED","FAILED"]),score:z.number().int().min(0).max(100)
  })},
  local_single_media: {public:true,description:"Get media for any clue of my local single question",schema:z.object({
    ...session,mediaId
  })},
  chance_balance: {public:true,description:"Read my chance balance and grant one chance on the first daily visit (signed-in users only)",schema:z.object({})},
  run_chance: {public:false,description:"Spend one account chance before the first guess of an active general quiz pack question",schema:z.object({runId:uuid,runToken:z.string().min(32).max(200),position:z.number().int().min(0).max(10000)})},
  run_start: { public: true, description: "Start or resume a pack, quick-five or continuous random play", schema: z.object({
    mode: z.enum(["RANDOM_FIVE","INFINITE","PACK"]), packId:uuid.optional(), resumeRunId:uuid.optional(), restart:z.boolean().default(false), lane: z.enum(["GENERAL","KIDS"]).default("GENERAL"),
    avoidQuizIds: z.array(uuid).max(1000).default([]), locale: optionalLocale
  }) },
  run_current: { public: true, description: "Get or resume the current server-side question of a run without revealing later clues", schema: z.object({
    runId: uuid, runToken: z.string().min(32).max(200), avoidQuizIds: z.array(uuid).max(1000).default([]), locale: localeCode.optional()
  }) },
  run_finish: { public: true, description: "Stop an infinite or practice run and view its scores", schema: z.object({
    runId: uuid, runToken: z.string().min(32).max(200), confirm: z.literal(true)
  }) },
  run_feedback: { public: true, description: "Read up to five completed run questions and reaction status by signed run token", schema: z.object({runId:uuid,runToken:z.string().min(32).max(200)}) },
  run_history: { public: false, description: "My latest scores and completed quiz runs", schema: z.object(paging) },
  run_reconcile: { public: false, description: "Rebuild my old finite-run totals from already saved question sessions", schema:z.object(paging) },
  run_share: { public: true, description: "Opt in to a public share link for my finished general pack result", schema:z.object({runId:uuid,runToken:z.string().min(32).max(200).optional()}) },
  run_unshare: { public: true, description: "Revoke my shared pack result URL", schema:z.object({runId:uuid,runToken:z.string().min(32).max(200).optional(),confirm:z.literal(true)}) },
  run_share_get: { public: true, description: "Read a voluntarily published pack result (no private score history)", schema:z.object({shareId:uuid}) },
  ranking_optin: { public: false, description: "Set my own public ranking consent, independent of staff adult verification", schema: z.object({ enabled: z.boolean(), confirm: z.literal(true) }) },
  adult_verify: { public: false, description: "ADMIN ONLY: independently verify or revoke an adult ranking eligibility status", schema: z.object({
    userId, verified: z.boolean(), reason: z.string().trim().min(8).max(1000), confirm: z.literal(true)
  }) }
} as const;
export type Operation = keyof typeof operations;
export function parseOperation(name: Operation, payload: unknown): Record<string, any> {
  return operations[name].schema.parse(payload) as Record<string, any>;
}
