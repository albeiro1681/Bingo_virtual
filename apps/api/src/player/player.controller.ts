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

  @Get('cards')
  async cards(@Req() request: PlayerRequest) {
    const [cards, game] = await Promise.all([
      this.prisma.card.findMany({
        where: { userId: request.player.id },
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
            where: { isFinal: true, card: { userId: request.player.id } },
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
