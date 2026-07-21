-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WinnerType" AS ENUM ('ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS', 'FULL_CARD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "tokenHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardCell" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "number" INTEGER,
    "isFree" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CardCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawnBall" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "drawOrder" INTEGER NOT NULL,
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawnBall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "type" "WinnerType" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_tokenHash_key" ON "User"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Card_serial_key" ON "Card"("serial");

-- CreateIndex
CREATE INDEX "Card_userId_idx" ON "Card"("userId");

-- CreateIndex
CREATE INDEX "Card_gameId_idx" ON "Card"("gameId");

-- CreateIndex
CREATE INDEX "CardCell_number_idx" ON "CardCell"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CardCell_cardId_row_column_key" ON "CardCell"("cardId", "row", "column");

-- CreateIndex
CREATE UNIQUE INDEX "CardCell_cardId_number_key" ON "CardCell"("cardId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DrawnBall_gameId_number_key" ON "DrawnBall"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DrawnBall_gameId_drawOrder_key" ON "DrawnBall"("gameId", "drawOrder");

-- CreateIndex
CREATE INDEX "Winner_gameId_idx" ON "Winner"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_gameId_cardId_type_key" ON "Winner"("gameId", "cardId", "type");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCell" ADD CONSTRAINT "CardCell_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawnBall" ADD CONSTRAINT "DrawnBall_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
