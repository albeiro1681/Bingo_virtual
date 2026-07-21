import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CardsService } from './cards.service';
import { GenerateCardsDto } from './dto/generate-cards.dto';

@Controller('api/admin/cards')
@UseGuards(AdminTokenGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list() {
    return this.cards.list();
  }

  @Get('catalog')
  catalog() {
    return this.cards.catalog();
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
