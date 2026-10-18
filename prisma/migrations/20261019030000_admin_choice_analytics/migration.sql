-- Existing sessions have no stored choice; do not infer historical votes.
ALTER TABLE "PlaySession" ADD COLUMN "firstChoice" TEXT;
