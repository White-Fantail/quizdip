-- Anonymous UX counters, not gameplay or identity records.
CREATE TABLE "GrowthFunnelDaily" ("day" DATE NOT NULL,"event" TEXT NOT NULL,"locale" TEXT NOT NULL,"channel" TEXT NOT NULL,"count" INTEGER NOT NULL DEFAULT 0,CONSTRAINT "GrowthFunnelDaily_pkey" PRIMARY KEY ("day","event","locale","channel"));
CREATE INDEX "GrowthFunnelDaily_day_event_idx" ON "GrowthFunnelDaily"("day","event");
