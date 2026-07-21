import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CardsService } from './cards.service';
import { GenerateCardsDto } from './dto/generate-cards.dto';

@Controller('api/admin/cards')
@UseGuards(AdminTokenGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@Query('gameId') gameId?: string) {
    return this.cards.list(gameId);
  }

  @Get('catalog')
  catalog(@Query('gameId') gameId?: string) {
    return this.cards.catalog(gameId);
  }

  @Post('catalog/initialize')
  initializeCatalog() {
    return this.cards.initializeCatalog();
  }

  @Post('generate')
  generate(@Body() dto: GenerateCardsDto) {
    return this.cards.generate(dto);
  }
}
