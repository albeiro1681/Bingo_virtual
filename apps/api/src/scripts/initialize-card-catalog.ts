import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CardsService } from '../cards/cards.service';

async function initialize(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const result = await app.get(CardsService).initializeCatalog();
    process.stdout.write(
      `Card catalog ready: ${result.count} templates (${result.created ? 'created' : 'already existed'})\n`,
    );
  } finally {
    await app.close();
  }
}

void initialize().catch((error: unknown) => {
  process.stderr.write(
    `Could not initialize card catalog: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
  );
  process.exitCode = 1;
});
