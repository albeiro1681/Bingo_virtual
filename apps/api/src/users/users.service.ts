import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateAccessToken, hashAccessToken } from '../auth/token';
import { CreatePlayerDto } from './dto/create-player.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlayer(dto: CreatePlayerDto) {
    const accessToken = generateAccessToken();
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone,
        tokenHash: hashAccessToken(accessToken),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
    return { ...user, accessToken };
  }

  listPlayers() {
    return this.prisma.user.findMany({
      where: { role: 'PLAYER' },
      select: {
        id: true,
        name: true,
        phone: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
