import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WinnersController } from './winners.controller';
import { WinnersService } from './winners.service';

@Module({
  imports: [AuthModule],
  controllers: [WinnersController],
  providers: [WinnersService],
})
export class WinnersModule {}
