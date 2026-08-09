import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { DrawsGateway } from './draws.gateway';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { DrawsService } from './draws.service';

jest.mock('./secure-random', () => ({
  selectSecureRandom: jest.fn((values: unknown[]) => values[0]),
}));

describe('DrawsService', () => {
  const notifyWinners = jest.fn().mockResolvedValue(undefined);
  const whatsapp = { notifyWinners } as unknown as WhatsAppService;

  beforeEach(() => jest.clearAllMocks());
  it('retries serialization conflicts up to the configured limit', async () => {
    const serializationConflict = Object.assign(new Error('retry'), {
      code: 'P2034',
    });
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(serializationConflict)
      .mockRejectedValueOnce(serializationConflict)
      .mockRejectedValueOnce(new ConflictException('not active'));
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const ballDrawn = jest.fn();
    const gateway = {
      ballDrawn,
      winnersDetected: jest.fn(),
      gameUpdated: jest.fn(),
    } as unknown as DrawsGateway;

    await expect(
      new DrawsService(prisma, gateway, whatsapp).draw('game-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(ballDrawn).not.toHaveBeenCalled();
  });

  it('retries a duplicate ball conflict before publishing the result', async () => {
    const duplicateBall = Object.assign(new Error('duplicate ball'), {
      code: 'P2002',
    });
    const result = {
      ball: { id: 'ball-1', number: 12 },
      winners: [],
      game: { id: 'game-1', status: 'ACTIVE' },
    };
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(duplicateBall)
      .mockResolvedValueOnce(result);
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const ballDrawn = jest.fn();
    const gateway = {
      ballDrawn,
      winnersDetected: jest.fn(),
      gameUpdated: jest.fn(),
    } as unknown as DrawsGateway;

    await expect(
      new DrawsService(prisma, gateway, whatsapp).draw('game-1'),
    ).resolves.toBe(result);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(ballDrawn).toHaveBeenCalledWith(result.ball);
  });

  it('does not send winner WhatsApp notifications while a tie is pending', async () => {
    const result = {
      ball: { id: 'ball-1', number: 12 },
      winners: [{ id: 'winner-1' }, { id: 'winner-2' }],
      game: { id: 'game-1', status: 'TIE_BREAK' },
      tied: true,
    };
    const prisma = {
      $transaction: jest.fn().mockResolvedValue(result),
    } as unknown as PrismaService;
    const winnersDetected = jest.fn();
    const gateway = {
      ballDrawn: jest.fn(),
      winnersDetected,
      gameUpdated: jest.fn(),
      tieBreakCompleted: jest.fn(),
    } as unknown as DrawsGateway;

    await expect(
      new DrawsService(prisma, gateway, whatsapp).draw('game-1'),
    ).resolves.toBe(result);
    expect(notifyWinners).not.toHaveBeenCalled();
    expect(winnersDetected).toHaveBeenCalledWith(result.winners);
  });

  it('persists every simultaneous bingo as a tie-break candidate', async () => {
    const cards = ['card-1', 'card-2'].map((id, index) => ({
      id,
      number: index + 1,
      userId: `user-${index + 1}`,
      cells: Array.from({ length: 25 }, (_, index) => ({
        row: Math.floor(index / 5),
        column: index % 5,
        number: index === 12 ? null : index + 1,
        isFree: index === 12,
      })),
    }));
    const winners = cards.map((card, index) => ({
      id: `winner-${index + 1}`,
      cardId: card.id,
      card: {
        id: card.id,
        number: index + 1,
        user: {
          id: `user-${index + 1}`,
          name: `Jugador ${index + 1}`,
          phone: `+57000000000${index + 1}`,
        },
      },
    }));
    let tieUpdate:
      { data: { status: string; finishedAt: Date | null } } | undefined;
    const tx = {
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'game-1',
          name: 'Empate',
          status: 'ACTIVE',
          winningType: 'CUSTOM',
          drawnBalls: [],
          winningCells: [{ row: 0, column: 0 }],
          finalWinnerId: null,
          startedAt: new Date(),
          finishedAt: null,
          endedManually: false,
        }),
        update: jest.fn(
          (input: { data: { status: string; finishedAt: Date | null } }) => {
            tieUpdate = input;
            return Promise.resolve({
              id: 'game-1',
              name: 'Empate',
              status: 'TIE_BREAK',
              finalWinnerId: null,
            });
          },
        ),
      },
      card: { findMany: jest.fn().mockResolvedValue(cards) },
      drawnBall: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'ball-1', number: 1, drawOrder: 1 }),
      },
      winner: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue(winners),
      },
      tieBreakCandidate: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const gateway = {
      ballDrawn: jest.fn(),
      winnersDetected: jest.fn(),
      gameUpdated: jest.fn(),
      tieBreakCompleted: jest.fn(),
    } as unknown as DrawsGateway;

    const result = await new DrawsService(prisma, gateway, whatsapp).draw(
      'game-1',
    );

    expect(result.tied).toBe(true);
    expect(tx.tieBreakCandidate.createMany).toHaveBeenCalledWith({
      data: [
        { gameId: 'game-1', cardId: 'card-1' },
        { gameId: 'game-1', cardId: 'card-2' },
      ],
      skipDuplicates: true,
    });
    expect(tx.game.update).toHaveBeenCalled();
    expect(tieUpdate?.data).toMatchObject({
      status: 'TIE_BREAK',
      finishedAt: null,
    });
    expect(notifyWinners).not.toHaveBeenCalled();
  });

  it('declares one winner without a tie when multiple winning cards belong to the same player', async () => {
    const cards = [
      { id: 'card-2', number: 22 },
      { id: 'card-1', number: 7 },
    ].map((card) => ({
      ...card,
      userId: 'user-1',
      cells: Array.from({ length: 25 }, (_, index) => ({
        row: Math.floor(index / 5),
        column: index % 5,
        number: index === 12 ? null : index + 1,
        isFree: index === 12,
      })),
    }));
    const persistedWinner = {
      id: 'winner-1',
      card: {
        ...cards[1],
        user: {
          id: 'user-1',
          name: 'Una jugadora',
          phone: '+573001234567',
        },
      },
    };
    const tx = {
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'game-1',
          name: 'Un solo jugador',
          status: 'ACTIVE',
          winningType: 'CUSTOM',
          drawnBalls: [],
          winningCells: [{ row: 0, column: 0 }],
          prizeAmount: 1500000,
          currencyCode: 'COP',
          finalWinnerId: null,
          startedAt: new Date(),
          finishedAt: null,
          endedManually: false,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'game-1',
          name: 'Un solo jugador',
          status: 'FINISHED',
          finalWinnerId: 'card-1',
          prizeAmount: 1500000,
          currencyCode: 'COP',
        }),
      },
      card: { findMany: jest.fn().mockResolvedValue(cards) },
      drawnBall: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'ball-1', number: 1, drawOrder: 1 }),
      },
      tieBreakCandidate: { createMany: jest.fn() },
      winner: { upsert: jest.fn().mockResolvedValue(persistedWinner) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const gateway = {
      ballDrawn: jest.fn(),
      winnersDetected: jest.fn(),
      gameUpdated: jest.fn(),
    } as unknown as DrawsGateway;

    const result = await new DrawsService(prisma, gateway, whatsapp).draw(
      'game-1',
    );

    expect(result.tied).toBe(false);
    expect(tx.tieBreakCandidate.createMany).not.toHaveBeenCalled();
    expect(tx.game.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FINISHED',
          finalWinnerId: 'card-1',
        }) as unknown,
      }),
    );
    expect(tx.winner.upsert).toHaveBeenCalledTimes(1);
    expect(tx.winner.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cardId: 'card-1',
          playerId: 'user-1',
          prizeAmount: 1500000,
        }) as unknown,
      }),
    );
    expect(result.winners).toHaveLength(1);
  });

  it('copies the game prize into the definitive winner record', async () => {
    const card = {
      id: 'card-1',
      userId: 'user-1',
      cells: Array.from({ length: 25 }, (_, index) => ({
        row: Math.floor(index / 5),
        column: index % 5,
        number: index === 12 ? null : index + 1,
        isFree: index === 12,
      })),
    };
    const winner = {
      id: 'winner-1',
      card: {
        ...card,
        number: 7,
        user: { id: 'user-1', name: 'Ana', phone: '+573001234567' },
      },
    };
    const tx = {
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'game-1',
          name: 'Premiado',
          status: 'ACTIVE',
          winningType: 'CUSTOM',
          drawnBalls: [],
          winningCells: [{ row: 0, column: 0 }],
          prizeAmount: 1500000,
          currencyCode: 'COP',
          finalWinnerId: null,
          startedAt: new Date(),
          finishedAt: null,
          endedManually: false,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'game-1',
          name: 'Premiado',
          status: 'FINISHED',
          prizeAmount: 1500000,
          currencyCode: 'COP',
        }),
      },
      card: { findMany: jest.fn().mockResolvedValue([card]) },
      drawnBall: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'ball-1', number: 1, drawOrder: 1 }),
      },
      tieBreakCandidate: { createMany: jest.fn() },
      winner: { upsert: jest.fn().mockResolvedValue(winner) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const gateway = {
      ballDrawn: jest.fn(),
      winnersDetected: jest.fn(),
      gameUpdated: jest.fn(),
    } as unknown as DrawsGateway;

    await new DrawsService(prisma, gateway, whatsapp).draw('game-1');

    expect(tx.winner.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          prizeAmount: 1500000,
          playerId: 'user-1',
          winningBallNumber: 1,
          isFinal: true,
        }) as unknown,
      }),
    );
  });

  it('selects one persisted tie candidate and only then sends WhatsApp', async () => {
    const candidates = [
      {
        id: 'candidate-1',
        cardId: 'card-1',
        card: {
          id: 'card-1',
          number: 7,
          user: { id: 'user-1', name: 'Uno', phone: '+570000000001' },
        },
      },
      {
        id: 'candidate-2',
        cardId: 'card-2',
        card: {
          id: 'card-2',
          number: 19,
          user: { id: 'user-2', name: 'Dos', phone: '+570000000002' },
        },
      },
    ];
    const winner = {
      id: 'winner-final',
      card: candidates[0].card,
    };
    const updatedGame = {
      id: 'game-1',
      name: 'Empate',
      status: 'FINISHED',
      finalWinnerId: 'card-1',
    };
    let finalUpdate:
      { data: { status: string; finalWinnerId: string } } | undefined;
    const tx = {
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'game-1',
          status: 'TIE_BREAK',
          finalWinnerId: null,
          winningType: 'FULL_CARD',
          prizeAmount: 1500000,
          currencyCode: 'COP',
          tieBreakCandidates: candidates,
        }),
        update: jest.fn(
          (input: { data: { status: string; finalWinnerId: string } }) => {
            finalUpdate = input;
            return Promise.resolve(updatedGame);
          },
        ),
      },
      winner: { upsert: jest.fn().mockResolvedValue(winner) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const tieBreakCompleted = jest.fn();
    const gateway = {
      ballDrawn: jest.fn(),
      winnersDetected: jest.fn(),
      gameUpdated: jest.fn(),
      tieBreakCompleted,
    } as unknown as DrawsGateway;

    const result = await new DrawsService(prisma, gateway, whatsapp).breakTie(
      'game-1',
    );

    expect(candidates.map((candidate) => candidate.card.number)).toContain(
      result.cardNumber,
    );
    expect(tx.game.update).toHaveBeenCalled();
    expect(finalUpdate?.data.status).toBe('FINISHED');
    expect(finalUpdate?.data.finalWinnerId).toMatch(/^card-[12]$/);
    expect(tieBreakCompleted).toHaveBeenCalledWith(result);
    expect(notifyWinners).toHaveBeenCalledWith({
      game: updatedGame,
      winners: [winner],
    });
  });

  it('rejects a repeated or unavailable tie-break', async () => {
    const tx = {
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'game-1',
          status: 'FINISHED',
          finalWinnerId: 'card-1',
          tieBreakCandidates: [],
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const gateway = {
      tieBreakCompleted: jest.fn(),
    } as unknown as DrawsGateway;

    await expect(
      new DrawsService(prisma, gateway, whatsapp).breakTie('game-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(notifyWinners).not.toHaveBeenCalled();
  });
});
