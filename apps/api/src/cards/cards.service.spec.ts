import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CardsService } from './cards.service';

describe('CardsService', () => {
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
      new CardsService(prisma, whatsapp).updatePlayerCards('player-2', [8]),
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
      new CardsService(prisma, whatsapp).generate({
        userId: 'player-1',
        cardNumbers: [8],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a permanent assignment without a game', async () => {
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
    const notifyAssignment = jest.fn().mockResolvedValue(undefined);
    const whatsapp = { notifyAssignment } as unknown as WhatsAppService;

    await expect(
      new CardsService(prisma, whatsapp).generate({
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
});
