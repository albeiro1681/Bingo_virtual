-- AlterEnum
ALTER TYPE "WinnerType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "patternId" TEXT,
ADD COLUMN     "patternName" TEXT;

-- CreateTable
CREATE TABLE "BingoPattern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BingoPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BingoPatternCell" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,

    CONSTRAINT "BingoPatternCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameWinningCell" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,

    CONSTRAINT "GameWinningCell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BingoPattern_name_key" ON "BingoPattern"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BingoPatternCell_patternId_row_column_key" ON "BingoPatternCell"("patternId", "row", "column");

-- CreateIndex
CREATE UNIQUE INDEX "GameWinningCell_gameId_row_column_key" ON "GameWinningCell"("gameId", "row", "column");

-- CreateIndex
CREATE INDEX "Game_patternId_idx" ON "Game"("patternId");

-- AddForeignKey
ALTER TABLE "BingoPatternCell" ADD CONSTRAINT "BingoPatternCell_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "BingoPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "BingoPattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameWinningCell" ADD CONSTRAINT "GameWinningCell_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
