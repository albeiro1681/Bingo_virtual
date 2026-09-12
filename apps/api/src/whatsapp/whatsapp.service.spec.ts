import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses PUBLIC_APP_URL for access links even when a previous URL is stored', async () => {
    const prisma = {
      whatsAppSettings: {
        findUnique: jest.fn().mockResolvedValue({
          publicAppUrl: 'https://anterior.example',
        }),
      },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string) =>
        key === 'PUBLIC_APP_URL'
          ? 'https://bingo.fecsupol.example/'
          : undefined,
      ),
    } as unknown as ConfigService;

    await expect(
      new WhatsAppService(prisma, config).accessLink('token privado'),
    ).resolves.toBe(
      'https://bingo.fecsupol.example/player?token=token%20privado',
    );
  });

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

  it('does not deliver twice when the same manual request is repeated', async () => {
    const delivery = {
      id: 'delivery-1',
      status: 'SENT',
      idempotencyKey: 'assignment-resend:player-1:request-1:+573001234567',
    };
    const upsert = jest.fn().mockResolvedValue(delivery);
    const prisma = {
      whatsAppDelivery: {
        upsert,
      },
      whatsAppSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string, fallback?: string) => fallback),
    } as unknown as ConfigService;
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new WhatsAppService(prisma, config);
    const input = {
      user: {
        id: 'player-1',
        name: 'Jugador',
        phone: '+573001234567',
      },
      cardNumbers: [8],
      idempotencyKey: delivery.idempotencyKey,
    };

    await service.notifyAssignment(input);
    await service.notifyAssignment(input);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
