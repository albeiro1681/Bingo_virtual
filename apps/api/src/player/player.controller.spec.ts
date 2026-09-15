import type { PrismaService } from '../prisma/prisma.service';
import type { PlayerRequest } from '../auth/player-token.guard';
import { PlayerController } from './player.controller';

describe('PlayerController', () => {
  it('returns the player and cards in one session request', async () => {
    const player = { id: 'player-1', name: 'Jugador de prueba' };
    const card = {
      id: 'card-1',
      number: 1,
      cells: [],
    };
    const findMany = jest.fn().mockResolvedValue([card]);
    const prisma = {
      card: { findMany },
      game: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const controller = new PlayerController(prisma);

    await expect(
      controller.session({ player } as PlayerRequest),
    ).resolves.toEqual({
      player,
      cards: [{ ...card, game: null }],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: player.id } }),
    );
  });
});
