import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService', () => {
  it('reports a retry as failed when WhatsApp is not configured', async () => {
    const delivery = {
      id: 'delivery-1',
      kind: 'PLAYER_ACCESS',
      status: 'FAILED',
      recipient: '+573001234567',
      templateName: 'player_access',
      payload: { parameters: ['Jugador', 'https://example.test/player'] },
      idempotencyKey: 'player-access:1',
      userId: 'player-1',
      gameId: null,
      winnerId: null,
      error: null,
    };
    const prisma = {
      whatsAppDelivery: {
        findUnique: jest.fn().mockResolvedValue(delivery),
        upsert: jest.fn().mockResolvedValue(delivery),
      },
      whatsAppSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string, fallback?: string) => fallback),
    } as unknown as ConfigService;

    await expect(
      new WhatsAppService(prisma, config).retryDelivery(delivery.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
