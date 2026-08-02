import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListWinnersDto, WinnerSort } from './dto/list-winners.dto';

@Injectable()
export class WinnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWinnersDto) {
    const search = query.search?.trim();
    const cardNumber = search && /^\d+$/.test(search) ? Number(search) : null;
    const where: Prisma.WinnerWhereInput = {
      isFinal: true,
      ...(query.gameId ? { gameId: query.gameId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            detectedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { player: { name: { contains: search, mode: 'insensitive' } } },
              ...(cardNumber ? [{ card: { number: cardNumber } }] : []),
            ],
          }
        : {}),
    };
    const orderBy: Prisma.WinnerOrderByWithRelationInput =
      query.sort === WinnerSort.DATE_ASC
        ? { detectedAt: 'asc' }
        : query.sort === WinnerSort.PRIZE_DESC
          ? { prizeAmount: { sort: 'desc', nulls: 'last' } }
          : query.sort === WinnerSort.PRIZE_ASC
            ? { prizeAmount: { sort: 'asc', nulls: 'last' } }
            : { detectedAt: 'desc' };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const [items, total, aggregate, games] = await Promise.all([
      this.prisma.winner.findMany({
        where,
        include: {
          game: { select: { id: true, name: true, startedAt: true } },
          player: { select: { id: true, name: true } },
          card: { select: { id: true, number: true, serial: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.winner.count({ where }),
      this.prisma.winner.aggregate({ where, _sum: { prizeAmount: true } }),
      this.prisma.winner.groupBy({ by: ['gameId'], where }),
    ]);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        totalWinners: total,
        totalPrizeAmount: aggregate._sum.prizeAmount,
        gamesWithWinner: games.length,
      },
    };
  }

  async detail(id: string) {
    const winner = await this.prisma.winner.findFirst({
      where: { id, isFinal: true },
      include: {
        game: {
          select: {
            id: true,
            name: true,
            startedAt: true,
            finishedAt: true,
            patternName: true,
            winningType: true,
          },
        },
        player: { select: { id: true, name: true, phone: true } },
        card: { select: { id: true, number: true, serial: true } },
      },
    });
    if (!winner) throw new NotFoundException('Winner not found');
    return winner;
  }
}
