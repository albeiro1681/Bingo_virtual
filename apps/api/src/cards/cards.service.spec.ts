import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CardsService } from './cards.service';

describe('CardsService', () => {
  it('rejects card numbers already assigned in the same game', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'player-1',
          name: 'Player',
          role: 'PLAYER',
          active: true,
          phone: '+573001234567',
        }),
      },
      game: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'game-1', name: 'Game', status: 'DRAFT' }),
      },
      cardTemplate: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'template-8', number: 8, cells: [] }]),
      },
      card: {
        findMany: jest.fn().mockResolvedValue([{ number: 8 }]),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const whatsapp = {
      notifyAssignment: jest.fn(),
    } as unknown as WhatsAppService;

    await expect(
      new CardsService(prisma, whatsapp).generate({
        userId: 'player-1',
        gameId: 'game-1',
        cardNumbers: [8],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
