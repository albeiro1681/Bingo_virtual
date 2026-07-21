import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { hashAccessToken } from './token';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    if (!token) throw new UnauthorizedException('Admin token is required');

    const admin = await this.prisma.user.findFirst({
      where: {
        tokenHash: hashAccessToken(token),
        role: 'ADMIN',
        active: true,
      },
      select: { id: true },
    });

    if (!admin) throw new UnauthorizedException('Invalid admin token');
    return true;
  }
}
