import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import { WinnerSort } from './dto/list-winners.dto';
import { WinnersService } from './winners.service';

describe('WinnersService', () => {
  it('filters final winners by player, game and date with pagination', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      winner: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { prizeAmount: null } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const service = new WinnersService(prisma);

    await service.list({
      search: 'Ana',
      gameId: 'game-1',
      dateFrom: '2026-08-01T00:00:00.000Z',
      dateTo: '2026-08-02T23:59:59.999Z',
      sort: WinnerSort.DATE_DESC,
      page: 2,
      pageSize: 10,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isFinal: true,
          gameId: 'game-1',
          detectedAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lte: new Date('2026-08-02T23:59:59.999Z'),
          },
        }) as unknown,
        skip: 10,
        take: 10,
      }),
    );
  });
});
