import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { generateAccessToken, hashAccessToken } from '../auth/token';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../auth/password';

async function createFirstAdmin(): Promise<void> {
  const name = process.env.ADMIN_NAME?.trim();
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || name.length < 2) {
    throw new Error('Set ADMIN_NAME to a name with at least 2 characters');
  }
  if (!username || !/^[a-zA-Z0-9._-]{3,50}$/.test(username))
    throw new Error('Set a valid ADMIN_USERNAME');
  if (!password || password.length < 10)
    throw new Error('Set ADMIN_PASSWORD with at least 10 characters');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (existingAdmin) {
      throw new Error('An administrator already exists');
    }

    const accessToken = generateAccessToken();
    const admin = await prisma.user.create({
      data: {
        name,
        role: 'ADMIN',
        tokenHash: hashAccessToken(accessToken),
        username,
        passwordHash: await hashPassword(password),
      },
      select: { id: true, name: true },
    });

    process.stdout.write(
      `Administrator created: ${admin.name} (${admin.id})\n`,
    );
  } finally {
    await app.close();
  }
}

void createFirstAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Could not create administrator: ${message}\n`);
  process.exitCode = 1;
});
