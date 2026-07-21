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
  cards(@Req() request: PlayerRequest) {
    return this.prisma.card.findMany({
      where: { userId: request.player.id },
      include: {
        cells: { orderBy: [{ column: 'asc' }, { row: 'asc' }] },
        game: {
          include: {
            winningCells: { orderBy: [{ row: 'asc' }, { column: 'asc' }] },
            drawnBalls: { orderBy: { drawOrder: 'asc' } },
            winners: { where: { card: { userId: request.player.id } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
