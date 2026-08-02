import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminTokenGuard } from './admin-token.guard';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto, @Req() request: Request) {
    return this.auth.login(dto.username, dto.password, request.ip);
  }

  @Post('logout')
  @UseGuards(AdminTokenGuard)
  logout(@Req() request: Request) {
    return this.auth.logout(
      request.header('authorization')!.slice('Bearer '.length).trim(),
    );
  }
}
