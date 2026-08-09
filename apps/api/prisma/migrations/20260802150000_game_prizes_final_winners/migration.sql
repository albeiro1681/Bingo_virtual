ALTER TABLE "Game"
ADD COLUMN "prizeAmount" DECIMAL(18,0),
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'COP';

ALTER TABLE "Winner"
ADD COLUMN "playerId" TEXT,
ADD COLUMN "prizeAmount" DECIMAL(18,0),
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'COP',
ADD COLUMN "winningBallNumber" INTEGER,
ADD COLUMN "isFinal" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Winner" AS winner
SET "playerId" = card."userId"
FROM "Card" AS card
WHERE winner."cardId" = card."id";

WITH winner_counts AS (
  SELECT "gameId", COUNT(*) AS total
  FROM "Winner"
  GROUP BY "gameId"
)
UPDATE "Winner" AS winner
SET "isFinal" = true
FROM "Game" AS game, winner_counts
WHERE winner."gameId" = game."id"
  AND winner_counts."gameId" = game."id"
  AND (
    game."finalWinnerId" = winner."cardId"
    OR (game."finalWinnerId" IS NULL AND winner_counts.total = 1)
  );

ALTER TABLE "Winner" ALTER COLUMN "playerId" SET NOT NULL;

CREATE UNIQUE INDEX "Winner_one_final_per_game_key"
ON "Winner" ("gameId")
WHERE "isFinal" = true;

CREATE INDEX "Winner_playerId_idx" ON "Winner"("playerId");
CREATE INDEX "Winner_cardId_idx" ON "Winner"("cardId");
CREATE INDEX "Winner_detectedAt_idx" ON "Winner"("detectedAt");

ALTER TABLE "Winner" ADD CONSTRAINT "Winner_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
