import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrawsGateway } from './draws.gateway';
import { DrawsController } from './draws.controller';
import { DrawsService } from './draws.service';

@Module({
  imports: [AuthModule],
  controllers: [DrawsController],
  providers: [DrawsGateway, DrawsService],
  exports: [DrawsGateway],
})
export class DrawsModule {}
