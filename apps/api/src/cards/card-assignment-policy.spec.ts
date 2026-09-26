import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import {
  assertCardAssignmentOpen,
  CARD_ASSIGNMENT_BLOCKED_MESSAGE,
} from './card-assignment-policy';

describe('card assignment policy', () => {
  it('allows assignments when there is no active game or tie-break', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const tx = { game: { findFirst } } as unknown as Prisma.TransactionClient;

    await expect(assertCardAssignmentOpen(tx)).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith({
      where: { status: { in: ['ACTIVE', 'TIE_BREAK'] } },
      select: { id: true },
    });
  });

  it('blocks assignments while a game is active or in tie-break', async () => {
    const tx = {
      game: { findFirst: jest.fn().mockResolvedValue({ id: 'game-1' }) },
    } as unknown as Prisma.TransactionClient;

    await expect(assertCardAssignmentOpen(tx)).rejects.toMatchObject({
      message: CARD_ASSIGNMENT_BLOCKED_MESSAGE,
    } as ConflictException);
  });
});
