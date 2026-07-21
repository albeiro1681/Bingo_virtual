import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { hashAccessToken } from './token';

export type PlayerRequest = Request & {
  player: { id: string; name: string };
};

@Injectable()
export class PlayerTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlayerRequest>();
    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;
    if (!token) throw new UnauthorizedException('Player token is required');

    const player = await this.prisma.user.findFirst({
      where: {
        tokenHash: hashAccessToken(token),
        role: 'PLAYER',
        active: true,
      },
      select: { id: true, name: true },
    });
    if (!player) throw new UnauthorizedException('Invalid player token');

    request.player = player;
    return true;
  }
}
