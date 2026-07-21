import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CardsModule } from './cards/cards.module';
import { DrawsModule } from './draws/draws.module';
import { GamesModule } from './games/games.module';
import { PrismaModule } from './prisma/prisma.module';
import { PlayerModule } from './player/player.module';
import { PatternsModule } from './patterns/patterns.module';
import { UsersModule } from './users/users.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'web', 'dist'),
      exclude: ['/api/{*path}'],
    }),
    PrismaModule,
    DrawsModule,
    UsersModule,
    GamesModule,
    CardsModule,
    PlayerModule,
    PatternsModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
