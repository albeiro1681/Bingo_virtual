import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { hashAccessToken } from '../auth/token';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedSocketData = { userId?: string; role?: 'ADMIN' | 'PLAYER' };

@WebSocketGateway({
  namespace: 'draws',
  cors: { origin: true, credentials: true },
})
export class DrawsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  private readonly players = new Map<
    string,
    { id: string; name: string; sockets: Set<string> }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token =
      typeof socket.handshake.auth.token === 'string'
        ? socket.handshake.auth.token
        : undefined;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    const tokenHash = hashAccessToken(token);
    const session = await this.prisma.adminSession.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        user: { active: true, role: 'ADMIN' },
      },
      select: { user: { select: { id: true, name: true, role: true } } },
    });
    let user = session?.user;
    let playerHasCards = false;
    if (!user) {
      const player = await this.prisma.user.findFirst({
        where: {
          tokenHash,
          active: true,
          role: 'PLAYER',
        },
        select: {
          id: true,
          name: true,
          role: true,
          _count: { select: { cards: true } },
        },
      });
      if (player) {
        playerHasCards = player._count.cards > 0;
        user = { id: player.id, name: player.name, role: player.role };
      }
    }
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const data = socket.data as AuthenticatedSocketData;
    data.userId = user.id;
    data.role = user.role;
    if (user.role === 'PLAYER') {
      await socket.join(this.playerRoom(user.id));
      if (!playerHasCards) return;
      const presence = this.players.get(user.id) ?? {
        id: user.id,
        name: user.name,
        sockets: new Set<string>(),
      };
      presence.sockets.add(socket.id);
      this.players.set(user.id, presence);
      this.emitPresence();
    }
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as AuthenticatedSocketData;
    if (data.role !== 'PLAYER' || typeof data.userId !== 'string') return;
    const presence = this.players.get(data.userId);
    if (!presence) return;
    presence.sockets.delete(socket.id);
    if (presence.sockets.size === 0) this.players.delete(data.userId);
    this.emitPresence();
  }

  activePlayers(): Array<{ id: string; name: string }> {
    return [...this.players.values()].map(({ id, name }) => ({ id, name }));
  }

  private emitPresence(): void {
    this.server.emit('players:active', this.activePlayers());
  }

  ballDrawn(payload: unknown): void {
    this.server.emit('ball:drawn', payload);
  }

  winnersDetected(payload: unknown): void {
    this.server.emit('winner:detected', payload);
  }

  tieBreakCompleted(payload: unknown): void {
    this.server.emit('tie-break:completed', payload);
  }

  gameUpdated(payload: unknown): void {
    this.server.emit('game:updated', payload);
  }

  async cardsUpdated(userId: string): Promise<void> {
    const room = this.playerRoom(userId);
    this.server.to(room).emit('cards:updated', { userId });
    const sockets = await this.server.in(room).fetchSockets();
    if (sockets.length === 0) return;
    const player = await this.prisma.user.findFirst({
      where: { id: userId, active: true, role: 'PLAYER', cards: { some: {} } },
      select: { id: true, name: true },
    });
    if (!player) {
      this.players.delete(userId);
      this.emitPresence();
      return;
    }
    this.players.set(userId, {
      ...player,
      sockets: new Set(sockets.map((socket) => socket.id)),
    });
    this.emitPresence();
  }

  private playerRoom(userId: string): string {
    return `player:${userId}`;
  }
}
