import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatternDto } from './dto/create-pattern.dto';

@Injectable()
export class PatternsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatternDto) {
    const uniqueCells = new Map(
      dto.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]),
    );
    if (uniqueCells.size !== dto.cells.length) {
      throw new ConflictException('A figure cannot contain duplicate cells');
    }
    return this.prisma.bingoPattern.create({
      data: {
        name: dto.name.trim(),
        cells: { create: [...uniqueCells.values()] },
      },
      include: { cells: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } },
    });
  }

  list() {
    return this.prisma.bingoPattern.findMany({
      where: { active: true },
      include: { cells: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } },
      orderBy: { name: 'asc' },
    });
  }
}
