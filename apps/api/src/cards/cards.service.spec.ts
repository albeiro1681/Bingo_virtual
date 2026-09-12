import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { DrawsGateway } from '../draws/draws.gateway';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CardsService } from './cards.service';

describe('CardsService', () => {
  const cardsUpdated = jest.fn().mockResolvedValue(undefined);
  const gateway = {
    cardsUpdated,
  } as unknown as DrawsGateway;
  it('blocks transfer after any draw has started', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'player-2',
          name: 'Two',
          role: 'PLAYER',
          active: true,
          phone: '+573001234568',
        }),
      },
      card: { findMany: jest.fn().mockResolvedValue([]) },
      cardTemplate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'template-8',
            number: 8,
            cells: [],
            card: { id: 'card-8', userId: 'player-1' },
          },
        ]),
      },
      game: { count: jest.fn().mockResolvedValue(1) },
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
      new CardsService(prisma, whatsapp, gateway).updatePlayerCards(
        'player-2',
        [8],
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects card numbers already assigned globally', async () => {
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
      new CardsService(prisma, whatsapp, gateway).generate({
        userId: 'player-1',
        cardNumbers: [8],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a permanent assignment even if WhatsApp fails', async () => {
    const user = {
      id: 'player-1',
      name: 'Player',
      role: 'PLAYER',
      active: true,
      phone: '+573001234567',
    };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
      cardTemplate: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'template-8', number: 8, cells: [] }]),
      },
      card: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'card-8',
          serial: 'FECSUPOL-008',
        }),
      },
      cardAssignmentAudit: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const notifyAssignment = jest
      .fn()
      .mockRejectedValue(new Error('WhatsApp unavailable'));
    const whatsapp = { notifyAssignment } as unknown as WhatsAppService;

    await expect(
      new CardsService(prisma, whatsapp, gateway).generate({
        userId: 'player-1',
        cardNumbers: [8],
      }),
    ).resolves.toMatchObject({
      count: 1,
      cards: [{ number: 8, serial: 'FECSUPOL-008' }],
    });
    expect(tx.card.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serial: 'FECSUPOL-008',
        userId: 'player-1',
        templateId: 'template-8',
        number: 8,
      }) as unknown,
      select: { id: true, serial: true },
    });
    expect(notifyAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'player-1' }) as unknown,
        cardNumbers: [8],
      }),
    );
  });

  it('saves an assignment without creating a WhatsApp delivery when disabled', async () => {
    const user = {
      id: 'player-1',
      name: 'Player',
      role: 'PLAYER',
      active: true,
      phone: '+573001234567',
    };
    const tx = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
      card: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'card-8', number: 8 }),
      },
      cardTemplate: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'template-8', number: 8, cells: [], card: null },
          ]),
      },
      game: { count: jest.fn().mockResolvedValue(0) },
      cardAssignmentAudit: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const notifyAssignment = jest.fn();
    const whatsapp = { notifyAssignment } as unknown as WhatsAppService;

    await expect(
      new CardsService(prisma, whatsapp, gateway).updatePlayerCards(
        'player-1',
        [8],
        undefined,
        false,
      ),
    ).resolves.toMatchObject({
      count: 1,
      cardNumbers: [8],
      whatsappStatus: 'SKIPPED',
    });
    expect(notifyAssignment).not.toHaveBeenCalled();
    expect(cardsUpdated).toHaveBeenCalledWith('player-1');
  });

  it('rejects resending a card that does not belong to the player', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'player-1',
          name: 'Player',
          phone: '+573001234567',
          cards: [],
        }),
      },
    } as unknown as PrismaService;
    const whatsapp = {
      notifyAssignment: jest.fn(),
    } as unknown as WhatsAppService;

    await expect(
      new CardsService(prisma, whatsapp, gateway).resendPlayerCards(
        'player-1',
        [8],
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('resends to a one-time recipient and gives each request its own delivery key', async () => {
    const user = {
      id: 'player-1',
      name: 'Player',
      phone: '+573001234567',
      cards: [{ number: 8 }],
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
    } as unknown as PrismaService;
    const notifyAssignment = jest.fn().mockResolvedValue({ status: 'SENT' });
    const whatsapp = { notifyAssignment } as unknown as WhatsAppService;
    const service = new CardsService(prisma, whatsapp, gateway);

    await service.resendPlayerCards('player-1', [8], {
      phone: '+573009876543',
      requestId: '1275b046-8269-4c35-8c1e-ecc05b7f4bd7',
    });
    await service.resendPlayerCards('player-1', [8], {
      phone: '+573009876543',
      requestId: 'e1f03c73-0270-425d-9928-a97faea9db0a',
    });

    expect(notifyAssignment).toHaveBeenNthCalledWith(1, {
      user: { id: user.id, name: user.name, phone: user.phone },
      cardNumbers: [8],
      recipient: '+573009876543',
      idempotencyKey:
        'assignment-resend:player-1:1275b046-8269-4c35-8c1e-ecc05b7f4bd7:+573009876543',
    });
    expect(notifyAssignment).toHaveBeenNthCalledWith(2, {
      user: { id: user.id, name: user.name, phone: user.phone },
      cardNumbers: [8],
      recipient: '+573009876543',
      idempotencyKey:
        'assignment-resend:player-1:e1f03c73-0270-425d-9928-a97faea9db0a:+573009876543',
    });
  });
});
