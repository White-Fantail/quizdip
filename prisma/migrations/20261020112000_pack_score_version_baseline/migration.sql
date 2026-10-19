-- Previously, editing a published question did not bump the version of a published
-- pack containing it. Start a new comparable-score epoch without rewriting
-- historical PlayRun.packVersion snapshots.
UPDATE "QuizPack"
SET "currentVersion" = "currentVersion" + 1
WHERE "publication" = 'PUBLISHED';
