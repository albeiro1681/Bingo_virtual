ALTER TABLE "User" ADD COLUMN "tokenEncrypted" TEXT;

CREATE TABLE "WhatsAppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accessTokenEncrypted" TEXT,
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v23.0',
    "templateLanguage" TEXT NOT NULL DEFAULT 'es',
    "playerAccessTemplate" TEXT NOT NULL DEFAULT 'player_access',
    "cardAssignmentTemplate" TEXT NOT NULL DEFAULT 'card_assignment',
    "winnerPlayerTemplate" TEXT NOT NULL DEFAULT 'winner_player',
    "winnerFundTemplate" TEXT NOT NULL DEFAULT 'winner_group',
    "fundContacts" TEXT,
    "publicAppUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WhatsAppSettings_singleton" CHECK ("id" = 1)
);

CREATE TABLE "CardAssignmentAudit" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardNumber" INTEGER NOT NULL,
    "previousUserId" TEXT,
    "newUserId" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardAssignmentAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CardAssignmentAudit_cardId_idx" ON "CardAssignmentAudit"("cardId");
CREATE INDEX "CardAssignmentAudit_createdAt_idx" ON "CardAssignmentAudit"("createdAt");
