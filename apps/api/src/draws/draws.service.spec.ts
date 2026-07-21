import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { DrawsGateway } from './draws.gateway';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { DrawsService } from './draws.service';

describe('DrawsService', () => {
  const whatsapp = { notifyWinners: jest.fn() } as unknown as WhatsAppService;
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
});
