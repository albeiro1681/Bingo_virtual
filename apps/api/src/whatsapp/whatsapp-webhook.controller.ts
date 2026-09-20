import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsAppService } from './whatsapp.service';

@Controller('api/whatsapp/webhook')
export class WhatsAppWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() response: Response,
  ) {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (!expected || mode !== 'subscribe' || token !== expected || !challenge)
      throw new UnauthorizedException('No se pudo verificar el webhook');
    return response.type('text/plain').send(challenge);
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: unknown,
  ) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    const signature = request.header('x-hub-signature-256');
    const rawBody = request.rawBody;
    if (!secret || !rawBody || !signature?.startsWith('sha256='))
      throw new UnauthorizedException('Firma de webhook no válida');

    const provided = signature.slice('sha256='.length);
    if (!/^[0-9a-fA-F]{64}$/.test(provided))
      throw new UnauthorizedException('Firma de webhook no válida');
    const actual = Buffer.from(provided, 'hex');
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    if (!timingSafeEqual(actual, expected))
      throw new UnauthorizedException('Firma de webhook no válida');

    await this.whatsapp.recordStatusWebhook(body);
    return { ok: true };
  }
}
