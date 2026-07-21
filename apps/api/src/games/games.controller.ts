import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { GamesService } from './games.service';

@Controller('api/admin/games')
@UseGuards(AdminTokenGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  create(@Body() dto: CreateGameDto) {
    return this.games.create(dto);
  }

  @Get()
  list() {
    return this.games.list();
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.games.start(id);
  }

  @Get(':id/winners')
  winners(@Param('id') id: string) {
    return this.games.winners(id);
  }

  @Get(':id/state')
  state(@Param('id') id: string) {
    return this.games.state(id);
  }
}
