-- Period-filtered admin analytics read paths. Existing history is retained.
CREATE INDEX IF NOT EXISTS "PlayRun_startedAt_idx" ON "PlayRun"("startedAt");
CREATE INDEX IF NOT EXISTS "PlaySession_startedAt_idx" ON "PlaySession"("startedAt");
