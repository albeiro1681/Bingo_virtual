import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LiveStreamModule } from '../live-stream/live-stream.module';
import { PlayerController } from './player.controller';

@Module({
  imports: [AuthModule, LiveStreamModule],
  controllers: [PlayerController],
})
export class PlayerModule {}
