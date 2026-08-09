import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService } from './admin-auth.service';
import { hashPassword } from './password';

describe('AdminAuthService', () => {
  it('creates a hashed, expiring session for valid credentials', async () => {
    const passwordHash = await hashPassword('Una-clave-segura-123');
    const createSession = jest.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'admin-1', name: 'Admin', passwordHash }),
      },
      adminSession: { create: createSession },
    } as unknown as PrismaService;
    const result = await new AdminAuthService(prisma).login(
      'ADMIN',
      'Una-clave-segura-123',
    );
    expect(result.token).toBeTruthy();
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('does not reveal whether the username or password was wrong', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(
      new AdminAuthService(prisma).login('missing', 'Una-clave-segura-123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks repeated failed login attempts for fifteen minutes', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new AdminAuthService(prisma);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login('admin', 'clave-incorrecta', '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.login('admin', 'clave-incorrecta', '127.0.0.1'),
    ).rejects.toMatchObject<HttpException>({ status: 429 });
  });
});
