import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { ListWinnersDto } from './dto/list-winners.dto';
import { WinnersService } from './winners.service';

@Controller('api/admin/winners')
@UseGuards(AdminTokenGuard)
export class WinnersController {
  constructor(private readonly winners: WinnersService) {}

  @Get()
  list(@Query() query: ListWinnersDto) {
    return this.winners.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.winners.detail(id);
  }
}
