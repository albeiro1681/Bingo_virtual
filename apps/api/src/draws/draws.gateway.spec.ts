import type { Server, Socket } from 'socket.io';
import type { PrismaService } from '../prisma/prisma.service';
import { DrawsGateway } from './draws.gateway';

describe('DrawsGateway', () => {
  it('keeps an active player without cards connected to receive assignments', async () => {
    const prisma = {
      adminSession: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'player-1',
          name: 'Jugador',
          role: 'PLAYER',
          _count: { cards: 0 },
        }),
      },
    } as unknown as PrismaService;
    const gateway = new DrawsGateway(prisma);
    const join = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn();
    const socket = {
      id: 'socket-1',
      handshake: { auth: { token: 'player-token' } },
      data: {},
      join,
      disconnect,
    } as unknown as Socket;

    await gateway.handleConnection(socket);

    expect(join).toHaveBeenCalledWith('player:player-1');
    expect(disconnect).not.toHaveBeenCalled();
    expect(gateway.activePlayers()).toEqual([]);
  });

  it('emits card updates only to the assigned player room', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'player-1',
          name: 'Jugador',
        }),
      },
    } as unknown as PrismaService;
    const emit = jest.fn();
    const toRoom = jest.fn().mockReturnValue({ emit });
    const gateway = new DrawsGateway(prisma);
    gateway.server = {
      to: toRoom,
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([{ id: 'socket-1' }]),
      }),
      emit: jest.fn(),
    } as unknown as Server;

    await gateway.cardsUpdated('player-1');

    expect(toRoom).toHaveBeenCalledWith('player:player-1');
    expect(emit).toHaveBeenCalledWith('cards:updated', {
      userId: 'player-1',
    });
    expect(gateway.activePlayers()).toEqual([
      { id: 'player-1', name: 'Jugador' },
    ]);
  });
});
