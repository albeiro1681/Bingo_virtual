import type { PrismaService } from '../prisma/prisma.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { UsersService } from './users.service';
import type { ConfigService } from '@nestjs/config';
import { encryptSecret } from '../auth/secret-box';

describe('UsersService', () => {
  it('returns and sends the same player access link when creating a player', async () => {
    const user = {
      id: 'player-1',
      name: 'Jugador',
      phone: '+573001234567',
      role: 'PLAYER',
      active: true,
      createdAt: new Date(),
    };
    const prisma = {
      user: { create: jest.fn().mockResolvedValue(user) },
    } as unknown as PrismaService;
    const accessLink = 'https://bingo.example/player?token=private';
    const notifyPlayerAccess = jest.fn().mockResolvedValue(accessLink);
    const whatsapp = { notifyPlayerAccess } as unknown as WhatsAppService;

    const config = {
      get: jest
        .fn()
        .mockReturnValue('a-secure-test-encryption-key-with-32-chars'),
    } as unknown as ConfigService;
    const result = await new UsersService(
      prisma,
      whatsapp,
      config,
    ).createPlayer({
      name: 'Jugador',
      phone: '+573001234567',
    });

    expect(result.accessLink).toBe(accessLink);
    expect(result.accessToken).toBeTruthy();
    expect(notifyPlayerAccess).toHaveBeenCalledWith({
      user: { id: user.id, name: user.name, phone: user.phone },
      accessToken: result.accessToken,
    });
  });

  it('previews valid rows with accents and normalized Colombian phones', async () => {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      cardTemplate: {
        findMany: jest.fn().mockResolvedValue([
          { number: 1, card: null },
          { number: 4, card: null },
        ]),
      },
    } as unknown as PrismaService;
    const service = new UsersService(
      prisma,
      {} as WhatsAppService,
      {} as ConfigService,
    );

    const result = await service.previewImport([
      {
        line: 2,
        name: '  María   Gómez ',
        phone: '3001234567',
        cardNumbers: [1, 4],
      },
    ]);

    expect(result.rows[0]).toMatchObject({
      name: 'María Gómez',
      phone: '+573001234567',
      valid: true,
    });
    expect(result.summary).toEqual({
      total: 1,
      valid: 1,
      invalid: 0,
      validUsers: 1,
      invalidUsers: 0,
      cardsToAssign: 2,
    });
  });

  it('reports duplicate users, invalid phones, missing, occupied and repeated cards per row', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ phone: '+573001234567' }]),
      },
      cardTemplate: {
        findMany: jest.fn().mockResolvedValue([
          { number: 1, card: null },
          { number: 8, card: { user: { name: 'Otro jugador' } } },
        ]),
      },
    } as unknown as PrismaService;
    const service = new UsersService(
      prisma,
      {} as WhatsAppService,
      {} as ConfigService,
    );
    const result = await service.previewImport([
      {
        line: 2,
        name: 'Pedro',
        phone: '+573001234567',
        cardNumbers: [1, 1, 8, 130],
      },
      {
        line: 3,
        name: 'Ana',
        phone: '2001234567',
        cardNumbers: [1],
      },
    ]);

    expect(result.rows[0].errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_USER',
        'DUPLICATE_CARD',
        'CARD_OCCUPIED',
        'CARD_NOT_FOUND',
        'DUPLICATE_CARD_FILE',
      ]),
    );
    expect(result.rows[1].errors.map((error) => error.code)).toContain(
      'INVALID_PHONE',
    );
  });

  it('continues bulk link delivery after individual failures and skips players without cards', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sent',
            name: 'Enviado',
            phone: '+573001234567',
            active: true,
            _count: { cards: 1 },
          },
          {
            id: 'failed',
            name: 'Fallido',
            phone: '+573001234568',
            active: true,
            _count: { cards: 2 },
          },
          {
            id: 'skipped',
            name: 'Sin cartones',
            phone: '+573001234569',
            active: true,
            _count: { cards: 0 },
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new UsersService(
      prisma,
      {} as WhatsAppService,
      {} as ConfigService,
    );
    jest
      .spyOn(service, 'sendAccessLink')
      .mockResolvedValueOnce({
        accessLink: 'link',
        status: 'SENT',
        error: null,
      })
      .mockRejectedValueOnce(new Error('Meta no disponible'));

    const result = await service.sendAccessLinks(['sent', 'failed', 'skipped']);

    expect(result).toMatchObject({ total: 3, sent: 1, failed: 1, skipped: 1 });
    expect(
      result.results.find((item) => item.userId === 'failed')?.reason,
    ).toBe('Meta no disponible');
  });

  it('sends an access link to a one-time recipient without changing the player', async () => {
    const encryptionKey = 'a-secure-test-encryption-key-with-32-chars';
    const user = {
      id: 'player-1',
      name: 'Jugador',
      phone: '+573001234567',
      tokenEncrypted: encryptSecret('private-token', encryptionKey),
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
    } as unknown as PrismaService;
    const sendPlayerAccess = jest.fn().mockResolvedValue({
      accessLink: 'https://bingo.example/player?token=private-token',
      status: 'SENT',
      error: null,
    });
    const whatsapp = { sendPlayerAccess } as unknown as WhatsAppService;
    const config = {
      get: jest.fn().mockReturnValue(encryptionKey),
    } as unknown as ConfigService;
    const service = new UsersService(prisma, whatsapp, config);

    await service.sendAccessLink('player-1', {
      phone: '+573009876543',
      requestId: '8c24f723-1afd-4c5f-8705-d9ebd0600e21',
    });

    expect(sendPlayerAccess).toHaveBeenCalledWith({
      user: { id: user.id, name: user.name, phone: user.phone },
      accessToken: 'private-token',
      recipient: '+573009876543',
      idempotencyKey:
        'player-access-manual:player-1:8c24f723-1afd-4c5f-8705-d9ebd0600e21:+573009876543',
    });
  });

  it('imports valid rows independently so one transactional failure does not stop the rest', async () => {
    const transaction = jest
      .fn()
      .mockResolvedValueOnce({ id: 'created-player' })
      .mockRejectedValueOnce(
        new Error('El cartón fue ocupado durante la importación'),
      );
    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new UsersService(
      prisma,
      {} as WhatsAppService,
      {} as ConfigService,
    );
    jest.spyOn(service, 'previewImport').mockResolvedValue({
      validRows: [
        {
          line: 2,
          name: 'María Gómez',
          phone: '+573001234567',
          cardNumbers: [1],
          valid: true,
          errors: [],
        },
        {
          line: 3,
          name: 'Pedro Pérez',
          phone: '+573001234568',
          cardNumbers: [4],
          valid: true,
          errors: [],
        },
      ],
      invalidRows: [],
      rows: [
        {
          line: 2,
          name: 'María Gómez',
          phone: '+573001234567',
          cardNumbers: [1],
          valid: true,
          errors: [],
        },
        {
          line: 3,
          name: 'Pedro Pérez',
          phone: '+573001234568',
          cardNumbers: [4],
          valid: true,
          errors: [],
        },
      ],
      summary: {
        total: 2,
        valid: 2,
        invalid: 0,
        validUsers: 2,
        invalidUsers: 0,
        cardsToAssign: 2,
      },
    });

    const result = await service.importPlayers([
      {
        line: 2,
        name: 'María Gómez',
        phone: '3001234567',
        cardNumbers: [1],
      },
      {
        line: 3,
        name: 'Pedro Pérez',
        phone: '3001234568',
        cardNumbers: [4],
      },
    ]);

    expect(result).toMatchObject({ imported: 1, failed: 1 });
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
