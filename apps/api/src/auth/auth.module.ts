import { Module } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { PlayerTokenGuard } from './player-token.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

@Module({
  controllers: [AdminAuthController],
  providers: [AdminTokenGuard, PlayerTokenGuard, AdminAuthService],
  exports: [AdminTokenGuard, PlayerTokenGuard],
})
export class AuthModule {}
