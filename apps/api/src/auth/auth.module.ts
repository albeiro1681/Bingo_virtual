import { Module } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { PlayerTokenGuard } from './player-token.guard';

@Module({
  providers: [AdminTokenGuard, PlayerTokenGuard],
  exports: [AdminTokenGuard, PlayerTokenGuard],
})
export class AuthModule {}
