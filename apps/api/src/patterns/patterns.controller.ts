import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { CreatePatternDto } from './dto/create-pattern.dto';
import { PatternsService } from './patterns.service';

@Controller('api/admin/patterns')
@UseGuards(AdminTokenGuard)
export class PatternsController {
  constructor(private readonly patterns: PatternsService) {}

  @Post()
  create(@Body() dto: CreatePatternDto) {
    return this.patterns.create(dto);
  }

  @Get()
  list() {
    return this.patterns.list();
  }
}
