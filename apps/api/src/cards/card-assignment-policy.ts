import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

export const CARD_ASSIGNMENT_BLOCKED_MESSAGE =
  'No se pueden asignar cartones mientras haya un sorteo activo o en desempate';

export async function assertCardAssignmentOpen(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const blockingGame = await tx.game.findFirst({
    where: { status: { in: ['ACTIVE', 'TIE_BREAK'] } },
    select: { id: true },
  });
  if (blockingGame) {
    throw new ConflictException(CARD_ASSIGNMENT_BLOCKED_MESSAGE);
  }
}
