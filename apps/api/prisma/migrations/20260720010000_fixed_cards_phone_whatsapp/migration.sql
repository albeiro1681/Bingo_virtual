-- CreateEnum
CREATE TYPE "WhatsAppDeliveryKind" AS ENUM ('CARD_ASSIGNMENT', 'WINNER_PLAYER', 'WINNER_GROUP', 'WINNER_CONTACT');

-- CreateEnum
CREATE TYPE "WhatsAppDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "number" INTEGER,
ADD COLUMN "templateId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTemplateCell" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "number" INTEGER,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CardTemplateCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppDelivery" (
    "id" TEXT NOT NULL,
    "kind" "WhatsAppDeliveryKind" NOT NULL,
    "status" "WhatsAppDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "gameId" TEXT,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardTemplate_number_key" ON "CardTemplate"("number");
CREATE UNIQUE INDEX "CardTemplateCell_templateId_row_column_key" ON "CardTemplateCell"("templateId", "row", "column");
CREATE UNIQUE INDEX "CardTemplateCell_templateId_number_key" ON "CardTemplateCell"("templateId", "number");
CREATE UNIQUE INDEX "WhatsAppDelivery_idempotencyKey_key" ON "WhatsAppDelivery"("idempotencyKey");
CREATE INDEX "WhatsAppDelivery_status_idx" ON "WhatsAppDelivery"("status");
CREATE INDEX "WhatsAppDelivery_userId_idx" ON "WhatsAppDelivery"("userId");
CREATE INDEX "WhatsAppDelivery_gameId_idx" ON "WhatsAppDelivery"("gameId");
CREATE INDEX "WhatsAppDelivery_winnerId_idx" ON "WhatsAppDelivery"("winnerId");
CREATE INDEX "Card_templateId_idx" ON "Card"("templateId");
CREATE UNIQUE INDEX "Card_gameId_templateId_key" ON "Card"("gameId", "templateId");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

ALTER TABLE "Card" ADD CONSTRAINT "Card_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardTemplateCell" ADD CONSTRAINT "CardTemplateCell_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDelivery" ADD CONSTRAINT "WhatsAppDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDelivery" ADD CONSTRAINT "WhatsAppDelivery_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDelivery" ADD CONSTRAINT "WhatsAppDelivery_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Winner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
