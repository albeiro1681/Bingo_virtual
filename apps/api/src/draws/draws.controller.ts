import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { DrawsService } from './draws.service';

@Controller('api/admin/games')
@UseGuards(AdminTokenGuard)
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Post(':id/draw')
  draw(@Param('id') id: string) {
    return this.draws.draw(id);
  }

  @Get('presence/current')
  presence() {
    return this.draws.activePlayers();
  }
}
