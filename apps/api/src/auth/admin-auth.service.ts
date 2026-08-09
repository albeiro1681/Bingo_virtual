import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateAccessToken, hashAccessToken } from './token';
import { verifyPassword } from './password';

@Injectable()
export class AdminAuthService {
  private readonly attempts = new Map<
    string,
    { count: number; blockedUntil: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string, source = 'unknown') {
    const normalizedUsername = username.trim().toLowerCase();
    const attemptKey = `${source}:${normalizedUsername}`;
    const now = Date.now();
    const current = this.attempts.get(attemptKey);
    if (current?.blockedUntil && current.blockedUntil > now) {
      throw new HttpException(
        'Demasiados intentos de acceso. Intenta nuevamente en 15 minutos',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const admin = await this.prisma.user.findFirst({
      where: {
        username: normalizedUsername,
        role: 'ADMIN',
        active: true,
      },
      select: { id: true, name: true, passwordHash: true },
    });
    if (
      !admin?.passwordHash ||
      !(await verifyPassword(password, admin.passwordHash))
    ) {
      const count =
        (current?.blockedUntil && current.blockedUntil <= now
          ? 0
          : (current?.count ?? 0)) + 1;
      this.attempts.set(attemptKey, {
        count,
        blockedUntil: count >= 5 ? now + 15 * 60 * 1000 : 0,
      });
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    this.attempts.delete(attemptKey);
    const token = generateAccessToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.prisma.adminSession.create({
      data: { userId: admin.id, tokenHash: hashAccessToken(token), expiresAt },
    });
    return { token, expiresAt, admin: { id: admin.id, name: admin.name } };
  }

  async logout(token: string): Promise<{ ok: true }> {
    await this.prisma.adminSession.deleteMany({
      where: { tokenHash: hashAccessToken(token) },
    });
    return { ok: true };
  }
}
