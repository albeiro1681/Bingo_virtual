import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString =
      config.get<string>('DATABASE_URL') ??
      PrismaService.buildDatabaseUrl(config);
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  private static buildDatabaseUrl(config: ConfigService): string {
    const url = new URL('postgresql://localhost:5432');
    url.username = config.getOrThrow<string>('POSTGRES_USER');
    url.password = config.getOrThrow<string>('POSTGRES_PASSWORD');
    url.pathname = config.getOrThrow<string>('POSTGRES_DB');
    url.searchParams.set('schema', 'public');
    return url.toString();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
