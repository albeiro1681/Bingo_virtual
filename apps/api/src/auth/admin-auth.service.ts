import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateAccessToken, hashAccessToken } from './token';
import { verifyPassword } from './password';

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string) {
    const admin = await this.prisma.user.findFirst({
      where: {
        username: username.trim().toLowerCase(),
        role: 'ADMIN',
        active: true,
      },
      select: { id: true, name: true, passwordHash: true },
    });
    if (
      !admin?.passwordHash ||
      !(await verifyPassword(password, admin.passwordHash))
    ) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
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
