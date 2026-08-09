import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { hashPassword } from '../auth/password';
import { PrismaService } from '../prisma/prisma.service';

async function setCredentials(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !/^[a-zA-Z0-9._-]{3,50}$/.test(username))
    throw new Error('Usuario inválido');
  if (!password || password.length < 10)
    throw new Error('La contraseña debe tener mínimo 10 caracteres');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('No existe un administrador');
    await prisma.$transaction([
      prisma.user.update({
        where: { id: admin.id },
        data: {
          username,
          passwordHash: await hashPassword(password),
          active: true,
        },
      }),
      prisma.adminSession.deleteMany({ where: { userId: admin.id } }),
    ]);
    process.stdout.write(`Credenciales actualizadas para ${username}\n`);
  } finally {
    await app.close();
  }
}

void setCredentials().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Error desconocido'}\n`,
  );
  process.exitCode = 1;
});
