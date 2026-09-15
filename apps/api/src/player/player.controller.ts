import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PlayerTokenGuard } from '../auth/player-token.guard';
import type { PlayerRequest } from '../auth/player-token.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/player')
@UseGuards(PlayerTokenGuard)
export class PlayerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  me(@Req() request: PlayerRequest) {
    return request.player;
  }

  @Get('session')
  async session(@Req() request: PlayerRequest) {
    return {
      player: request.player,
      cards: await this.cardsForPlayer(request.player.id),
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
