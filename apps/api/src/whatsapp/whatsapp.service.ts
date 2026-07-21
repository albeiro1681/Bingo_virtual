import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type TemplateMessage = {
  kind: 'CARD_ASSIGNMENT' | 'WINNER_PLAYER' | 'WINNER_GROUP' | 'WINNER_CONTACT';
  recipient: string;
  templateName: string;
  parameters: string[];
  idempotencyKey: string;
  userId?: string;
  gameId?: string;
  winnerId?: string;
  group?: boolean;
};

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async notifyAssignment(input: {
    user: { id: string; name: string; phone: string };
    game: { id: string; name: string };
    cardNumbers: number[];
    accessToken: string;
  }): Promise<void> {
    const baseUrl = this.config.get<string>(
      'PUBLIC_APP_URL',
      'http://127.0.0.1:3000',
    );
    const link = `${baseUrl.replace(/\/$/, '')}/player?token=${encodeURIComponent(input.accessToken)}`;
    await this.send({
      kind: 'CARD_ASSIGNMENT',
      recipient: input.user.phone,
      templateName: this.config.get<string>(
        'WHATSAPP_TEMPLATE_CARD_ASSIGNMENT',
        'card_assignment',
      ),
      parameters: [
        input.user.name,
        input.game.name,
        input.cardNumbers.join(', '),
        link,
      ],
      idempotencyKey: `assignment:${input.game.id}:${input.user.id}:${input.cardNumbers.join('-')}`,
      userId: input.user.id,
      gameId: input.game.id,
    });
  }

  async notifyWinners(input: {
    game: { id: string; name: string };
    winners: Array<{
      id: string;
      card: {
        number: number | null;
        user: { id: string; name: string; phone: string | null };
      };
    }>;
  }): Promise<void> {
    for (const winner of input.winners) {
      if (!winner.card.user.phone) continue;
      await this.send({
        kind: 'WINNER_PLAYER',
        recipient: winner.card.user.phone,
        templateName: this.config.get<string>(
          'WHATSAPP_TEMPLATE_WINNER_PLAYER',
          'winner_player',
        ),
        parameters: [
          winner.card.user.name,
          input.game.name,
          String(winner.card.number ?? ''),
        ],
        idempotencyKey: `winner-player:${winner.id}`,
        userId: winner.card.user.id,
        gameId: input.game.id,
        winnerId: winner.id,
      });
    }

    const summary = input.winners
      .map(
        (winner) =>
          `${winner.card.user.name} (cartón ${winner.card.number ?? '—'})`,
      )
      .join(', ');
    const groupId = this.config.get<string>('WHATSAPP_GROUP_ID');
    if (groupId) {
      await this.send({
        kind: 'WINNER_GROUP',
        recipient: groupId,
        templateName: this.config.get<string>(
          'WHATSAPP_TEMPLATE_WINNER_GROUP',
          'winner_group',
        ),
        parameters: [input.game.name, summary],
        idempotencyKey: `winner-group:${input.game.id}:${input.winners.map((winner) => winner.id).join('-')}`,
        gameId: input.game.id,
        group: true,
      });
      return;
    }

    const contacts = this.config
      .get<string>('WHATSAPP_FUND_CONTACTS', '')
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);
    for (const phone of contacts) {
      await this.send({
        kind: 'WINNER_CONTACT',
        recipient: phone,
        templateName: this.config.get<string>(
          'WHATSAPP_TEMPLATE_WINNER_GROUP',
          'winner_group',
        ),
        parameters: [input.game.name, summary],
        idempotencyKey: `winner-contact:${input.game.id}:${phone}:${input.winners.map((winner) => winner.id).join('-')}`,
        gameId: input.game.id,
      });
    }
  }

  private async send(message: TemplateMessage): Promise<void> {
    const delivery = await this.prisma.whatsAppDelivery.upsert({
      where: { idempotencyKey: message.idempotencyKey },
      create: {
        kind: message.kind,
        recipient: message.recipient,
        templateName: message.templateName,
        payload: {
          parameters: message.parameters,
          group: message.group ?? false,
        },
        idempotencyKey: message.idempotencyKey,
        userId: message.userId,
        gameId: message.gameId,
        winnerId: message.winnerId,
      },
      update: {},
    });
    if (delivery.status === 'SENT') return;

    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) return;

    try {
      const version = this.config.get<string>(
        'WHATSAPP_GRAPH_API_VERSION',
        'v23.0',
      );
      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: message.group ? 'group' : 'individual',
            to: message.recipient.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: message.templateName,
              language: {
                code: this.config.get<string>(
                  'WHATSAPP_TEMPLATE_LANGUAGE',
                  'es',
                ),
              },
              components: [
                {
                  type: 'body',
                  parameters: message.parameters.map((text) => ({
                    type: 'text',
                    text,
                  })),
                },
              ],
            },
          }),
        },
      );
      const body = (await response.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          body.error?.message ?? `WhatsApp HTTP ${response.status}`,
        );
      await this.prisma.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SENT',
          attempts: { increment: 1 },
          providerMessageId: body.messages?.[0]?.id,
        },
      });
    } catch (error: unknown) {
      await this.prisma.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          attempts: { increment: 1 },
          error:
            error instanceof Error ? error.message : 'Unknown WhatsApp error',
        },
      });
    }
  }
}
