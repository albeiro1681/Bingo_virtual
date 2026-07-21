import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlayerController } from './player.controller';

@Module({ imports: [AuthModule], controllers: [PlayerController] })
export class PlayerModule {}
