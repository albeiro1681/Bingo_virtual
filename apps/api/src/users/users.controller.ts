import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UsersService } from './users.service';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { ImportPlayersDto } from './dto/import-players.dto';
import { BulkSendLinksDto } from './dto/bulk-send-links.dto';
import { parseUsersCsvFile, type UploadedCsvFile } from './users-csv';

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

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2_000_000 } }))
  previewImport(@UploadedFile() file?: UploadedCsvFile) {
    return this.users.previewImport(parseUsersCsvFile(file));
  }

  @Post('import') importPlayers(@Body() dto: ImportPlayersDto) {
    return this.users.importPlayers(dto.rows);
  }

  @Post('access-links/send') sendLinks(@Body() dto: BulkSendLinksDto) {
    return this.users.sendAccessLinks(dto.userIds);
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
