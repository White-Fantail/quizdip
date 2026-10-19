-- Account chances and versioned pack combo scoring.
ALTER TABLE "User" ADD COLUMN "chanceBalance" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "chanceGrantDay" TEXT;
ALTER TABLE "PlayRun" ADD COLUMN "scoringVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "currentCombo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bestCombo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chancesUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlaySession" ADD COLUMN "hadWrongGuess" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "chanceHint" TEXT;
