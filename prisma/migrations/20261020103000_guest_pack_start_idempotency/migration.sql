-- A nullable unique key deduplicates guest PACK run_start retries and parallel tabs.
-- Existing runs remain untouched. The raw random key is never stored.
ALTER TABLE "PlayRun" ADD COLUMN "guestStartKeyHash" TEXT;
CREATE UNIQUE INDEX "PlayRun_guestStartKeyHash_key" ON "PlayRun"("guestStartKeyHash");
