import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { DrawsGateway } from '../draws/draws.gateway';
import { GamesService } from './games.service';
import { GameWinMode } from './dto/create-game.dto';

describe('GamesService', () => {
  const gameUpdated = jest.fn();
  const gateway = { gameUpdated } as unknown as DrawsGateway;

  beforeEach(() => jest.clearAllMocks());

  it('copies the selected figure into the game snapshot', async () => {
    const cells = [
      { row: 0, column: 0 },
      { row: 1, column: 1 },
    ];
    const tx = {
      bingoPattern: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pattern-1',
          name: 'Diagonal corta',
          active: true,
          cells,
        }),
      },
      game: { create: jest.fn().mockResolvedValue({ id: 'game-1' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await new GamesService(prisma, gateway).create({
      name: 'Sorteo figura',
      prizeAmount: 1500000,
      winMode: GameWinMode.FIGURE,
      patternId: 'pattern-1',
    });

    expect(tx.game.create).toHaveBeenCalledWith({
      data: {
        name: 'Sorteo figura',
        winningType: 'CUSTOM',
        patternId: 'pattern-1',
        patternName: 'Diagonal corta',
        prizeAmount: 1500000,
        winningCells: { create: cells },
      },
      include: { winningCells: true },
    });
  });

  it('rejects editing a game that has already started', async () => {
    const tx = {
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'game-1',
          status: 'ACTIVE',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new GamesService(prisma, gateway).update('game-1', {
        prizeAmount: 2000000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('starts a draft game when no other game is active', async () => {
    const tx = {
      card: { count: jest.fn().mockResolvedValue(1) },
      game: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'game-1', status: 'DRAFT' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'game-1', status: 'ACTIVE' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new GamesService(prisma, gateway).start('game-1'),
    ).resolves.toMatchObject({
      status: 'ACTIVE',
    });
    expect(tx.game.update).toHaveBeenCalledTimes(1);
    expect(gameUpdated).toHaveBeenCalledWith({
      id: 'game-1',
      status: 'ACTIVE',
    });
  });

  it('rejects starting a game while another is active', async () => {
    const tx = {
      card: { count: jest.fn().mockResolvedValue(1) },
      game: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'game-1', status: 'DRAFT' }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'game-2', status: 'ACTIVE' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new GamesService(prisma, gateway).start('game-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects starting a game without permanent card assignments', async () => {
    const tx = {
      card: { count: jest.fn().mockResolvedValue(0) },
      game: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'game-1', status: 'DRAFT' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new GamesService(prisma, gateway).start('game-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finishes an active game manually and publishes the update', async () => {
    const finished = {
      id: 'game-1',
      status: 'FINISHED',
      endedManually: true,
    };
    const tx = {
      game: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'game-1', status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue(finished),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new GamesService(prisma, gateway).finish('game-1'),
    ).resolves.toBe(finished);
    expect(tx.game.update).toHaveBeenCalledWith({
      where: { id: 'game-1' },
      data: {
        status: 'FINISHED',
        finishedAt: expect.any(Date) as Date,
        endedManually: true,
      },
    });
    expect(gameUpdated).toHaveBeenCalledWith(finished);
  });
});
