ALTER TYPE "GameStatus" ADD VALUE 'TIE_BREAK';

ALTER TABLE "Game"
ADD COLUMN "finalWinnerId" TEXT,
ADD COLUMN "tieBreakCompletedAt" TIMESTAMP(3);

CREATE TABLE "TieBreakCandidate" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TieBreakCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TieBreakCandidate_gameId_cardId_key" ON "TieBreakCandidate"("gameId", "cardId");
CREATE INDEX "TieBreakCandidate_gameId_idx" ON "TieBreakCandidate"("gameId");
CREATE INDEX "TieBreakCandidate_cardId_idx" ON "TieBreakCandidate"("cardId");
CREATE INDEX "Game_finalWinnerId_idx" ON "Game"("finalWinnerId");

ALTER TABLE "Game" ADD CONSTRAINT "Game_finalWinnerId_fkey" FOREIGN KEY ("finalWinnerId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TieBreakCandidate" ADD CONSTRAINT "TieBreakCandidate_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TieBreakCandidate" ADD CONSTRAINT "TieBreakCandidate_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
