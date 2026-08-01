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
import { CreatePlayerDto } from './dto/create-player.dto';
import { UsersService } from './users.service';
import { UpdatePlayerDto } from './dto/update-player.dto';

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

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.users.updatePlayer(id, dto);
  }
  @Get(':id/access-link') accessLink(@Param('id') id: string) {
    return this.users.getAccessLink(id);
  }
  @Post(':id/access-link/regenerate') regenerate(@Param('id') id: string) {
    return this.users.regenerateAccessLink(id);
  }
  @Post(':id/access-link/send') sendLink(@Param('id') id: string) {
    return this.users.sendAccessLink(id);
  }
}
