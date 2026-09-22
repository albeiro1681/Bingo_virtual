import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrawsModule } from '../draws/draws.module';
import { LiveStreamController } from './live-stream.controller';
import { LiveStreamService } from './live-stream.service';

@Module({
  imports: [AuthModule, DrawsModule],
  controllers: [LiveStreamController],
  providers: [LiveStreamService],
  exports: [LiveStreamService],
})
export class LiveStreamModule {}
