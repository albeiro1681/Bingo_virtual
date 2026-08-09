-- Cartones previamente asociados a sorteos de prueba fueron eliminados con
-- aprobación antes de aplicar esta migración. A partir de aquí la asignación
-- es global y cada plantilla solo puede pertenecer a un jugador.

-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_gameId_fkey";

-- DropIndex
DROP INDEX "Card_gameId_idx";

-- DropIndex
DROP INDEX "Card_gameId_templateId_key";

-- DropIndex
DROP INDEX "Card_templateId_idx";

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "gameId",
ALTER COLUMN "number" SET NOT NULL,
ALTER COLUMN "templateId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "endedManually" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Card_templateId_key" ON "Card"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_number_key" ON "Card"("number");
