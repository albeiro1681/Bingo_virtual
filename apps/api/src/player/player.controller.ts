import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PlayerTokenGuard } from '../auth/player-token.guard';
import type { PlayerRequest } from '../auth/player-token.guard';
import { LiveStreamService } from '../live-stream/live-stream.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/player')
@UseGuards(PlayerTokenGuard)
export class PlayerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liveStream: LiveStreamService,
  ) {}

  @Get('me')
  me(@Req() request: PlayerRequest) {
    return request.player;
  }

  @Get('session')
  async session(@Req() request: PlayerRequest) {
    const [cards, liveStream] = await Promise.all([
      this.cardsForPlayer(request.player.id),
      this.liveStream.getSettings(),
    ]);
    return {
      player: request.player,
      cards,
      liveStream,
    };
  }

  @Get('cards')
  cards(@Req() request: PlayerRequest) {
    return this.cardsForPlayer(request.player.id);
  }

  private async cardsForPlayer(playerId: string) {
    const [cards, game] = await Promise.all([
      this.prisma.card.findMany({
        where: { userId: playerId },
        include: {
          cells: { orderBy: [{ column: 'asc' }, { row: 'asc' }] },
        },
        orderBy: { number: 'asc' },
      }),
      this.prisma.game.findFirst({
        where: { status: { in: ['ACTIVE', 'TIE_BREAK', 'FINISHED'] } },
        include: {
          winningCells: { orderBy: [{ row: 'asc' }, { column: 'asc' }] },
          drawnBalls: { orderBy: { drawOrder: 'asc' } },
          winners: {
            where: { isFinal: true, card: { userId: playerId } },
          },
          finalWinner: {
            select: { id: true, number: true, userId: true },
          },
          tieBreakCandidates: {
            include: {
              card: { select: { id: true, number: true, userId: true } },
            },
            orderBy: { card: { number: 'asc' } },
          },
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);
    return cards.map((card) => ({ ...card, game }));
  }
}
