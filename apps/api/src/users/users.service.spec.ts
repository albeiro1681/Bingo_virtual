import type { PrismaService } from '../prisma/prisma.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { UsersService } from './users.service';
import type { ConfigService } from '@nestjs/config';

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
});
