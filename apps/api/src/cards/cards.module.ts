import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrawsModule } from '../draws/draws.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [AuthModule, DrawsModule],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
