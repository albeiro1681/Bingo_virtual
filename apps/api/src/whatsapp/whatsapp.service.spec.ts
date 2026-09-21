import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../auth/secret-box';
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

    for (const status of ['SENT', 'DELIVERED', 'READ', 'FAILED']) {
      upsert.mockResolvedValue({ ...delivery, status });
      await service.notifyAssignment(input);
      await service.notifyAssignment(input);
    }

    expect(upsert).toHaveBeenCalledTimes(8);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses the combined Utility template with an encrypted stored access link', async () => {
    const encryptionKey = 'a-secure-test-encryption-key-with-32-chars';
    const storedLink = 'https://bingo.example/player?token=private-token';
    const upsert = jest.fn().mockResolvedValue({
      id: 'delivery-1',
      status: 'PENDING',
    });
    const prisma = {
      whatsAppSettings: {
        findUnique: jest.fn().mockResolvedValue({
          cardAssignmentTemplate: 'card_assignment_access_v1',
          publicAppUrl: 'https://bingo.example',
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          tokenEncrypted: encryptSecret('private-token', encryptionKey),
        }),
      },
      whatsAppDelivery: {
        upsert,
        update: jest.fn().mockResolvedValue({ status: 'SENT' }),
      },
      whatsAppStatusEvent: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'APP_ENCRYPTION_KEY') return encryptionKey;
        if (key === 'WHATSAPP_ACCESS_TOKEN') return 'test-token';
        if (key === 'WHATSAPP_PHONE_NUMBER_ID') return 'test-phone-id';
        return fallback;
      }),
    } as unknown as ConfigService;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid-test' }] }),
    } as Response);

    await new WhatsAppService(prisma, config).notifyAssignment({
      user: { id: 'player-1', name: 'Jugador', phone: '+573001234567' },
      cardNumbers: [8, 12],
    });

    const create = (
      upsert.mock.calls as Array<
        [
          {
            create: {
              idempotencyKey: string;
              payload: { parameters: Array<string | { encrypted: string }> };
            };
          },
        ]
      >
    )[0][0].create;
    expect(create.idempotencyKey).toBe('assignment-access:player-1:8-12');
    expect(JSON.stringify(create.payload)).not.toContain('private-token');
    const storedLinkParameter = create.payload.parameters[2];
    if (typeof storedLinkParameter === 'string')
      throw new Error('El enlace se guardó sin cifrar');
    expect(decryptSecret(storedLinkParameter.encrypted, encryptionKey)).toBe(
      storedLink,
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string) as {
      template: object;
    };
    expect(sent.template).toMatchObject({
      name: 'card_assignment_access_v1',
      components: [
        {
          parameters: [
            { text: 'Jugador' },
            { text: '8, 12' },
            { text: storedLink },
          ],
        },
      ],
    });
  });

  it('keeps the existing two-parameter assignment template unchanged by default', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'delivery-1',
      status: 'SENT',
    });
    const findUser = jest.fn();
    const prisma = {
      whatsAppSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: findUser },
      whatsAppDelivery: { upsert },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string, fallback?: string) => fallback),
    } as unknown as ConfigService;

    await new WhatsAppService(prisma, config).notifyAssignment({
      user: { id: 'player-1', name: 'Jugador', phone: '+573001234567' },
      cardNumbers: [8, 12],
    });

    expect(findUser).not.toHaveBeenCalled();
    const create = (upsert.mock.calls as Array<[{ create: object }]>)[0][0]
      .create;
    expect(create).toMatchObject({
      templateName: 'card_assignment',
      idempotencyKey: 'assignment:player-1:8-12',
      payload: { parameters: ['Jugador', '8, 12'] },
    });
  });

  it('decrypts stored access links when retrying a failed delivery', async () => {
    const encryptionKey = 'a-secure-test-encryption-key-with-32-chars';
    const link = 'https://bingo.example/player?token=private-token';
    const delivery = {
      id: 'delivery-1',
      kind: 'CARD_ASSIGNMENT',
      status: 'FAILED',
      recipient: '+573001234567',
      templateName: 'card_assignment_access_v1',
      payload: {
        parameters: [
          'Jugador',
          '8',
          { encrypted: encryptSecret(link, encryptionKey) },
        ],
      },
      idempotencyKey: 'assignment-access:player-1:8',
      userId: 'player-1',
      gameId: null,
      winnerId: null,
    };
    const prisma = {
      whatsAppSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      whatsAppDelivery: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(delivery)
          .mockResolvedValueOnce({ ...delivery, status: 'SENT' }),
        upsert: jest.fn().mockResolvedValue(delivery),
        update: jest.fn().mockResolvedValue({ status: 'SENT' }),
      },
      whatsAppStatusEvent: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'APP_ENCRYPTION_KEY') return encryptionKey;
        if (key === 'WHATSAPP_ACCESS_TOKEN') return 'test-token';
        if (key === 'WHATSAPP_PHONE_NUMBER_ID') return 'test-phone-id';
        return fallback;
      }),
    } as unknown as ConfigService;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid-test' }] }),
    } as Response);

    await new WhatsAppService(prisma, config).retryDelivery(delivery.id);

    const sent = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string) as {
      template: { components: Array<{ parameters: Array<{ text: string }> }> };
    };
    expect(sent.template.components[0].parameters[2].text).toBe(link);
  });

  it('keeps the strongest receipt when callbacks arrive repeated or out of order', async () => {
    type Receipt = {
      providerMessageId: string;
      status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
      occurredAt: Date;
      errorCode: string | null;
    };
    const events: Receipt[] = [];
    const delivery = { providerMessageId: 'wamid-test', status: 'SENT' };
    const prisma = {
      whatsAppStatusEvent: {
        createMany: jest.fn(({ data }: { data: Receipt[] }) => {
          for (const item of data) {
            if (
              !events.some(
                (saved) =>
                  saved.providerMessageId === item.providerMessageId &&
                  saved.status === item.status &&
                  saved.occurredAt.getTime() === item.occurredAt.getTime(),
              )
            )
              events.push(item);
          }
          return { count: 1 };
        }),
        findMany: jest.fn(() => events),
      },
      whatsAppDelivery: {
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { providerMessageId: string; status: { in: string[] } };
            data: { status: string };
          }) => {
            if (
              where.providerMessageId === delivery.providerMessageId &&
              where.status.in.includes(delivery.status)
            )
              delivery.status = data.status;
            return { count: 1 };
          },
        ),
      },
    } as unknown as PrismaService;
    const service = new WhatsAppService(prisma, {} as ConfigService);
    const callback = (status: string, timestamp: string) => ({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid-test',
                    status,
                    timestamp,
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    await service.recordStatusWebhook(callback('read', '1789900000'));
    await service.recordStatusWebhook(callback('delivered', '1789900001'));
    await service.recordStatusWebhook(callback('failed', '1789900002'));
    await service.recordStatusWebhook(callback('read', '1789900000'));

    expect(delivery.status).toBe('READ');
    expect(events).toHaveLength(3);
  });

  it('reconciles a receipt received before the API response was saved', async () => {
    const delivery = {
      id: 'delivery-early',
      status: 'PENDING',
      providerMessageId: null as string | null,
    };
    type Receipt = {
      providerMessageId: string;
      status: 'DELIVERED';
      occurredAt: Date;
      errorCode: null;
    };
    const events: Receipt[] = [];
    const prisma = {
      whatsAppSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      whatsAppDelivery: {
        upsert: jest.fn().mockResolvedValue(delivery),
        findUnique: jest.fn(() => delivery),
        update: jest.fn(
          ({
            data,
          }: {
            data: { status: string; providerMessageId: string };
          }) => {
            delivery.status = data.status;
            delivery.providerMessageId = data.providerMessageId;
            return delivery;
          },
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { providerMessageId: string; status: { in: string[] } };
            data: { status: string };
          }) => {
            if (
              delivery.providerMessageId === where.providerMessageId &&
              where.status.in.includes(delivery.status)
            )
              delivery.status = data.status;
            return { count: 1 };
          },
        ),
      },
      whatsAppStatusEvent: {
        createMany: jest.fn(({ data }: { data: Receipt[] }) => {
          events.push(...data);
          return { count: 1 };
        }),
        findMany: jest.fn(() => events),
      },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((key: string, fallback?: string) =>
        key === 'WHATSAPP_ACCESS_TOKEN'
          ? 'test-token'
          : key === 'WHATSAPP_PHONE_NUMBER_ID'
            ? 'test-phone-id'
            : fallback,
      ),
    } as unknown as ConfigService;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid-early' }] }),
    } as Response);
    const service = new WhatsAppService(prisma, config);

    await service.recordStatusWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid-early',
                    status: 'delivered',
                    timestamp: '1789900000',
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(delivery.status).toBe('PENDING');

    await service.notifyAssignment({
      user: { id: 'user-1', name: 'Prueba', phone: '+573001234567' },
      cardNumbers: [1],
    });
    expect(delivery.status).toBe('DELIVERED');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not expose recipients, private links or provider error details in the admin list', async () => {
    const prisma = {
      whatsAppDelivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'delivery-1',
            kind: 'PLAYER_ACCESS',
            status: 'FAILED',
            recipient: '+573001234567',
            attempts: 1,
            createdAt: new Date('2026-09-20T12:00:00Z'),
            providerStatusAt: null,
            error: 'private-link?token=not-for-ui',
            user: { name: 'Prueba' },
          },
        ]),
      },
    } as unknown as PrismaService;

    const result = await new WhatsAppService(
      prisma,
      {} as ConfigService,
    ).listDeliveries();
    expect(result[0]).toMatchObject({
      recipientMasked: '••••4567',
      error: 'Meta rechazó el envío o falló la conexión.',
    });
    expect(JSON.stringify(result)).not.toContain('not-for-ui');
    expect(JSON.stringify(result)).not.toContain('+573001234567');
  });
});
