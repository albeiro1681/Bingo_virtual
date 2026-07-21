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
        where: { status: { in: ['ACTIVE', 'FINISHED'] } },
        include: {
          winningCells: { orderBy: [{ row: 'asc' }, { column: 'asc' }] },
          drawnBalls: { orderBy: { drawOrder: 'asc' } },
          winners: { where: { card: { userId: request.player.id } } },
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);
    return cards.map((card) => ({ ...card, game }));
  }
}
