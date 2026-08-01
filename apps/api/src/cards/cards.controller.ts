import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CardsService } from './cards.service';
import { GenerateCardsDto } from './dto/generate-cards.dto';
import { UpdatePlayerCardsDto } from './dto/update-player-cards.dto';

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

  @Put('player/:userId')
  updatePlayerCards(
    @Param('userId') userId: string,
    @Body() dto: UpdatePlayerCardsDto,
  ) {
    return this.cards.updatePlayerCards(userId, dto.cardNumbers);
  }
}
