import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DrawsGateway } from '../draws/draws.gateway';
import { CreateGameDto, GameWinMode } from './dto/create-game.dto';

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DrawsGateway,
  ) {}

  create(dto: CreateGameDto) {
    return this.prisma.$transaction(async (tx) => {
      const winMode = dto.winMode ?? GameWinMode.FULL_CARD;
      if (winMode === GameWinMode.FULL_CARD) {
        if (dto.patternId) {
          throw new BadRequestException(
            'Full-card games cannot select a figure',
          );
        }
        return tx.game.create({
          data: { name: dto.name.trim(), winningType: 'FULL_CARD' },
        });
      }

      if (!dto.patternId) {
        throw new BadRequestException('Figure games must select a pattern');
      }
      const pattern = await tx.bingoPattern.findFirst({
        where: { id: dto.patternId, active: true },
        include: { cells: true },
      });
      if (!pattern) throw new NotFoundException('Active figure not found');

      return tx.game.create({
        data: {
          name: dto.name.trim(),
          winningType: 'CUSTOM',
          patternId: pattern.id,
          patternName: pattern.name,
          winningCells: {
            create: pattern.cells.map(({ row, column }) => ({ row, column })),
          },
        },
        include: { winningCells: true },
      });
    });
  }

  async list() {
    const [games, assignedCards] = await Promise.all([
      this.prisma.game.findMany({
        include: {
          winningCells: { orderBy: [{ row: 'asc' }, { column: 'asc' }] },
          _count: { select: { drawnBalls: true, winners: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.card.count(),
    ]);
    return games.map((game) => ({
      ...game,
      _count: { ...game._count, cards: assignedCards },
    }));
  }

  winners(id: string) {
    return this.prisma.winner.findMany({
      where: { gameId: id },
      include: {
        card: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { detectedAt: 'asc' },
    });
  }

  async state(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        winningCells: { orderBy: [{ row: 'asc' }, { column: 'asc' }] },
        drawnBalls: { orderBy: { drawOrder: 'asc' } },
        winners: {
          include: {
            card: { include: { user: { select: { id: true, name: true } } } },
          },
          orderBy: { detectedAt: 'asc' },
        },
      },
    });
    if (!game) throw new NotFoundException('Game not found');
    return { ...game, _count: { cards: await this.prisma.card.count() } };
  }

  async start(id: string) {
    const game = await this.prisma.$transaction(
      async (tx) => {
        const game = await tx.game.findUnique({ where: { id } });
        if (!game) throw new NotFoundException('Game not found');
        if (game.status !== 'DRAFT') {
          throw new ConflictException('Only draft games can be started');
        }

        const [active, assignedCards] = await Promise.all([
          tx.game.findFirst({ where: { status: 'ACTIVE' } }),
          tx.card.count(),
        ]);
        if (active)
          throw new ConflictException('Another game is already active');
        if (assignedCards === 0) {
          throw new ConflictException(
            'At least one card must be assigned before starting a game',
          );
        }

        return tx.game.update({
          where: { id },
          data: { status: 'ACTIVE', startedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    this.gateway.gameUpdated(game);
    return game;
  }

  async finish(id: string) {
    const game = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.game.findUnique({ where: { id } });
        if (!current) throw new NotFoundException('Game not found');
        if (current.status !== 'ACTIVE') {
          throw new ConflictException('Only an active game can be finished');
        }
        return tx.game.update({
          where: { id },
          data: {
            status: 'FINISHED',
            finishedAt: new Date(),
            endedManually: true,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    this.gateway.gameUpdated(game);
    return game;
  }
}
