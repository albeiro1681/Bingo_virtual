ALTER TYPE "WhatsAppDeliveryStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "WhatsAppDeliveryStatus" ADD VALUE 'READ';

ALTER TABLE "WhatsAppDelivery" ADD COLUMN "providerStatusAt" TIMESTAMP(3);
CREATE INDEX "WhatsAppDelivery_providerMessageId_idx" ON "WhatsAppDelivery"("providerMessageId");

CREATE TABLE "WhatsAppStatusEvent" (
    "id" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "status" "WhatsAppDeliveryStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppStatusEvent_providerMessageId_status_occurredAt_key"
ON "WhatsAppStatusEvent"("providerMessageId", "status", "occurredAt");
CREATE INDEX "WhatsAppStatusEvent_providerMessageId_idx" ON "WhatsAppStatusEvent"("providerMessageId");
