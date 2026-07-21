import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UsersService } from './users.service';

@Controller('api/admin/users')
@UseGuards(AdminTokenGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.users.createPlayer(dto);
  }

  @Get()
  list() {
    return this.users.listPlayers();
  }
}
