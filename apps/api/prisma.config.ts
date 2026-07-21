import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../../.env' });

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const url = new URL('postgresql://localhost:5432');
  url.username = process.env.POSTGRES_USER ?? '';
  url.password = process.env.POSTGRES_PASSWORD ?? '';
  url.pathname = process.env.POSTGRES_DB ?? '';
  url.searchParams.set('schema', 'public');
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl(),
  },
});
