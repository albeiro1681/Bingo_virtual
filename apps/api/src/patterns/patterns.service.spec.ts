import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { PatternsService } from './patterns.service';

describe('PatternsService', () => {
  it('rejects the free center cell in a custom figure', async () => {
    const create = jest.fn();
    const prisma = {
      bingoPattern: { create },
    } as unknown as PrismaService;

    await expect(
      new PatternsService(prisma).create({
        name: 'Centro inválido',
        cells: [{ row: 2, column: 2 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
