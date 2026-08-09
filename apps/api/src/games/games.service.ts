import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DrawsGateway } from '../draws/draws.gateway';
import { CreateGameDto, GameWinMode } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

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
          data: {
            name: dto.name.trim(),
            winningType: 'FULL_CARD',
            prizeAmount: dto.prizeAmount,
          },
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
          prizeAmount: dto.prizeAmount,
          winningCells: {
            create: pattern.cells.map(({ row, column }) => ({ row, column })),
          },
        },
        include: { winningCells: true },
      });
    });
  }

  update(id: string, dto: UpdateGameDto) {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id } });
      if (!game) throw new NotFoundException('Game not found');
      if (game.status !== 'DRAFT') {
        throw new ConflictException('Only draft games can be edited');
      }

      const nextWinningType =
        dto.winMode === undefined
          ? game.winningType
          : dto.winMode === GameWinMode.FIGURE
            ? 'CUSTOM'
            : 'FULL_CARD';
      if (nextWinningType === 'FULL_CARD') {
        if (dto.patternId) {
          throw new BadRequestException(
            'Full-card games cannot select a figure',
          );
        }
        return tx.game.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.prizeAmount !== undefined
              ? { prizeAmount: dto.prizeAmount }
              : {}),
            winningType: 'FULL_CARD',
            patternId: null,
            patternName: null,
            winningCells: { deleteMany: {} },
          },
          include: { winningCells: true },
        });
      }

      const patternId = dto.patternId ?? game.patternId;
      if (!patternId) {
        throw new BadRequestException('Figure games must select a pattern');
      }
      const pattern = await tx.bingoPattern.findFirst({
        where: { id: patternId, active: true },
        include: { cells: true },
      });
      if (!pattern) throw new NotFoundException('Active figure not found');
      return tx.game.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.prizeAmount !== undefined
            ? { prizeAmount: dto.prizeAmount }
            : {}),
          winningType: 'CUSTOM',
          patternId: pattern.id,
          patternName: pattern.name,
          winningCells: {
            deleteMany: {},
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
          finalWinner: {
            select: { id: true, number: true, userId: true },
          },
          tieBreakCandidates: {
            include: {
              card: { select: { id: true, number: true, userId: true } },
            },
            orderBy: { card: { number: 'asc' } },
          },
          _count: {
            select: { drawnBalls: true, winners: { where: { isFinal: true } } },
          },
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
      where: { gameId: id, isFinal: true },
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
        finalWinner: {
          select: {
            id: true,
            number: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
        tieBreakCandidates: {
          include: {
            card: {
              select: {
                id: true,
                number: true,
                userId: true,
                user: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { card: { number: 'asc' } },
        },
        winners: {
          where: { isFinal: true },
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
          tx.game.findFirst({
            where: { status: { in: ['ACTIVE', 'TIE_BREAK'] } },
          }),
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
