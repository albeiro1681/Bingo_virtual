import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { GamesService } from './games.service';
import { UpdateGameDto } from './dto/update-game.dto';

@Controller('api/admin/games')
@UseGuards(AdminTokenGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  create(@Body() dto: CreateGameDto) {
    return this.games.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGameDto) {
    return this.games.update(id, dto);
  }

  @Get()
  list() {
    return this.games.list();
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.games.start(id);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string) {
    return this.games.finish(id);
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
