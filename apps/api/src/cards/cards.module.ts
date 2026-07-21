import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [AuthModule],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
