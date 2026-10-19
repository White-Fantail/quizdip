-- Creator-ordered, optional related pack links and idempotent completed-run attribution.
ALTER TABLE "QuizPack" ADD COLUMN "recommendedPackIds" JSONB NOT NULL DEFAULT '[]';
CREATE TABLE "PackRecommendationEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourcePackId" TEXT NOT NULL,
    "targetPackId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PackRecommendationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PackRecommendationEvent_runId_targetPackId_kind_key" ON "PackRecommendationEvent"("runId","targetPackId","kind");
CREATE INDEX "PackRecommendationEvent_sourcePackId_kind_createdAt_idx" ON "PackRecommendationEvent"("sourcePackId","kind","createdAt");
ALTER TABLE "PackRecommendationEvent" ADD CONSTRAINT "PackRecommendationEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PlayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
