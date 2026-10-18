/**
 * Public authoring capabilities advertised to REST and MCP consumers.
 * Keep limits and optional fields aligned with operations in contracts.ts.
 */
export const platformCatalog = {
  modes: ["progressive-clues"],
  answerTypes: ["person", "animal", "place", "thing", "event", "concept", "other"],
  responseModes: ["text", "multiple-choice"],
  multipleChoice: {
    minOptions: 2, maxOptions: 6, canonicalInOptions: true, scoreFactor: 0.75,
    zeroClueAllowed: true, zeroClueCorrectScore: 75,
  },
  topics: { model: "unified", tool: "quizdip_topic_list", maxPerQuiz: 12, normalizes: true },
  clueTypes: ["text", "image", "image-reveal", "audio", "video", "map"],
  imageRevealEffects: ["zoom", "spotlight"],
  mediaReference: "mediaId",
  promptMediaIds: true,
  mediaLimitsBytes: { image: 12582912, audio: 26214400, video: 67108864 },
  // Legacy minClues is the absolute minimum. Text-answer quizzes still require one.
  minClues: 0,
  minCluesByResponseMode: { text: 1, "multiple-choice": 0 },
  maxClues: 15,
  quizAuthoring: {
    explanation: {
      field: "explanation", optional: true, maxLength: 4000,
      shown: "only_after_final_answer",
      supportedOperations: ["quiz_create", "quiz_update", "quiz_translation_save"],
    },
    noClueMultipleChoice: {
      enabled: true, clues: [], responseMode: "multiple-choice",
      directAnswer: true, correctScore: 75,
      textAnswerStillRequiresClue: true,
    },
  },
  packAuthoring: {
    maxQuestions: 100,
    description: { optional: true, maxLength: 2000, preservesNewlines: true },
    coverMediaId: { optional: true, kind: "image", mustBeApprovedForPublication: true },
    sections: {
      optional: true, field: "sections", maxSections: 30,
      shape: { start: "one-based question position", title: "required for each section", description: "optional", mediaId: "optional image mediaId" },
      titleMaxLength: 120, descriptionMaxLength: 500,
      firstStart: 1, startsStrictlyIncreasing: true, requiresOrderMode: "CREATOR",
      dedicatedTransitionScreen: true, countedAsQuestion: false,
      imagesMustBeApprovedForPublication: true,
    },
    closingMessage: {
      optional: true, field: "closingMessage", maxLength: 4000,
      shown: "after_all_pack_questions",
    },
    scoreReviews: {
      optional: true, field: "scoreReviews", maxEntries: 20,
      shape: { minimumScore: "integer total points", title: "required", description: "optional" },
      minimumScoreRange: [0, 10000], titleMaxLength: 120, descriptionMaxLength: 1500,
      thresholdsStrictlyIncreasing: true, thresholdUnit: "total_points_not_percentage",
      shown: "at_pack_completion",
    },
    supportedOperations: ["pack_create", "pack_update"],
  },
  packLocalization: {
    supportedLocales: ["en", "ko"],
    sourcePreserved: true,
    operationToInspectLanguages: "pack_languages",
    operationToSaveOrPublish: "pack_translation_upsert",
    supportedOperations: ["pack_languages", "pack_translation_upsert"],
    fields: {
      title: { required: true, maxLength: 180 },
      description: { optional: true, maxLength: 2000 },
      sections: {
        optionalForDraft: true, requiredForPublishingWhenPresentInSource: true,
        maxSections: 30, fields: ["start", "title", "description"],
        titleMaxLength: 120, descriptionMaxLength: 500,
        matchesOriginalStartPositions: true,
        originalMediaAndOrderPreserved: true,
        acceptsMediaId: false,
      },
      closingMessage: {
        optionalForDraft: true, maxLength: 4000,
        requiredForPublishingWhenPresentInSource: true,
      },
      scoreReviews: {
        optionalForDraft: true, requiredForPublishingWhenPresentInSource: true,
        maxEntries: 20, fields: ["minimumScore", "title", "description"],
        titleMaxLength: 120, descriptionMaxLength: 1500,
        originalMinimumScoresPreserved: true,
      },
    },
    publication: {
      status: ["DRAFT", "PUBLISHED", "HIDDEN"],
      requiresConfirm: true,
      requiresPublishedSourcePack: true,
      requiresCompleteQuestionLanguageCoverage: true,
      missingLanguageNeverFallsBackToSourceText: true,
    },
  },
  userAdjustable: ["answerType", "topics", "creatorIntent", "recommendedAudience", "clues", "answer", "explanation"],
  platformControlled: ["safetyStatus", "kidsEligible", "kidsReviewStatus"],
  playModes: ["RANDOM_FIVE", "INFINITE", "PACK"],
  audiences: ["GENERAL", "KIDS"],
  quickStartQuestions: 5,
  editorialPicks: "ACTIVE",
  packOrderModes: ["CREATOR", "RANDOM"],
  version: "v3",
  catalogRevision: "2026-10-18-pack-full-localizations",
  format: "progressive-clues",
};
