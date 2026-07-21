import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { generateAccessToken, hashAccessToken } from '../auth/token';
import { PrismaService } from '../prisma/prisma.service';

async function createFirstAdmin(): Promise<void> {
  const name = process.env.ADMIN_NAME?.trim();
  if (!name || name.length < 2) {
    throw new Error('Set ADMIN_NAME to a name with at least 2 characters');
  }

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
      },
      select: { id: true, name: true },
    });

    process.stdout.write(
      `Administrator created: ${admin.name} (${admin.id})\nAccess token (shown once): ${accessToken}\n`,
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
