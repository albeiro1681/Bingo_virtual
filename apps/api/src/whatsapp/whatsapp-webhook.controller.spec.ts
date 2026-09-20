import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppWebhookController', () => {
  const secret = 'secreto-de-prueba';
  const config = {
    get: jest.fn((key: string) =>
      key === 'WHATSAPP_APP_SECRET'
        ? secret
        : key === 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'
          ? 'verificar-prueba'
          : undefined,
    ),
  } as unknown as ConfigService;
  const recordStatusWebhook = jest.fn().mockResolvedValue(undefined);
  const whatsapp = { recordStatusWebhook } as unknown as WhatsAppService;
  const controller = new WhatsAppWebhookController(config, whatsapp);

  beforeEach(() => recordStatusWebhook.mockClear());

  it('returns the challenge only for the configured verification token', () => {
    const response = {
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response;

    controller.verify('subscribe', 'verificar-prueba', '12345', response);
    expect(response.send).toHaveBeenCalledWith('12345');
    expect(() =>
      controller.verify('subscribe', 'incorrecto', '12345', response),
    ).toThrow(UnauthorizedException);
  });

  it('rejects missing or invalid signatures without processing the payload', async () => {
    const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
    const request = {
      rawBody,
      header: jest.fn().mockReturnValue('sha256=' + '0'.repeat(64)),
    } as unknown as RawBodyRequest<Request>;

    await expect(controller.receive(request, {})).rejects.toThrow(
      UnauthorizedException,
    );
    expect(recordStatusWebhook).not.toHaveBeenCalled();
  });

  it('processes a callback signed over the exact raw request body', async () => {
    const body = { object: 'whatsapp_business_account', entry: [] };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const request = {
      rawBody,
      header: jest.fn().mockReturnValue(`sha256=${signature}`),
    } as unknown as RawBodyRequest<Request>;

    await expect(controller.receive(request, body)).resolves.toEqual({
      ok: true,
    });
    expect(recordStatusWebhook).toHaveBeenCalledWith(body);
  });
});
