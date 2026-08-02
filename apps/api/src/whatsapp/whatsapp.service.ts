import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../auth/secret-box';
import { UpdateWhatsAppSettingsDto } from './dto/update-whatsapp-settings.dto';

type TemplateMessage = {
  kind:
    | 'PLAYER_ACCESS'
    | 'CARD_ASSIGNMENT'
    | 'WINNER_PLAYER'
    | 'WINNER_GROUP'
    | 'WINNER_CONTACT';
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

  private encryptionKey(): string {
    const value = this.config.get<string>('APP_ENCRYPTION_KEY');
    if (!value || value.length < 32)
      throw new BadRequestException(
        'APP_ENCRYPTION_KEY must contain at least 32 characters',
      );
    return value;
  }

  private async settings() {
    const stored = await this.prisma.whatsAppSettings.findUnique({
      where: { id: 1 },
    });
    return {
      accessToken: stored?.accessTokenEncrypted
        ? decryptSecret(stored.accessTokenEncrypted, this.encryptionKey())
        : this.config.get<string>('WHATSAPP_ACCESS_TOKEN'),
      phoneNumberId:
        stored?.phoneNumberId ||
        this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
      businessAccountId: stored?.businessAccountId || '',
      graphApiVersion:
        stored?.graphApiVersion ||
        this.config.get<string>('WHATSAPP_GRAPH_API_VERSION', 'v23.0'),
      templateLanguage:
        stored?.templateLanguage ||
        this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE', 'es'),
      playerAccessTemplate:
        stored?.playerAccessTemplate ||
        this.config.get<string>(
          'WHATSAPP_TEMPLATE_PLAYER_ACCESS',
          'player_access',
        ),
      cardAssignmentTemplate:
        stored?.cardAssignmentTemplate ||
        this.config.get<string>(
          'WHATSAPP_TEMPLATE_CARD_ASSIGNMENT',
          'card_assignment',
        ),
      winnerPlayerTemplate:
        stored?.winnerPlayerTemplate ||
        this.config.get<string>(
          'WHATSAPP_TEMPLATE_WINNER_PLAYER',
          'winner_player',
        ),
      winnerFundTemplate:
        stored?.winnerFundTemplate ||
        this.config.get<string>(
          'WHATSAPP_TEMPLATE_WINNER_GROUP',
          'winner_group',
        ),
      fundContacts:
        stored?.fundContacts ||
        this.config.get<string>('WHATSAPP_FUND_CONTACTS', ''),
      publicAppUrl:
        stored?.publicAppUrl ||
        this.config.get<string>('PUBLIC_APP_URL', 'http://127.0.0.1:3000'),
    };
  }

  async getPublicSettings() {
    const value = await this.settings();
    return {
      ...value,
      accessToken: undefined,
      accessTokenConfigured: Boolean(value.accessToken),
    };
  }

  async updateSettings(dto: UpdateWhatsAppSettingsDto) {
    const { accessToken, ...data } = dto;
    const accessTokenEncrypted = accessToken
      ? encryptSecret(accessToken, this.encryptionKey())
      : undefined;
    await this.prisma.whatsAppSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data, accessTokenEncrypted },
      update: { ...data, accessTokenEncrypted },
    });
    return this.getPublicSettings();
  }

  async testConnection() {
    const value = await this.settings();
    if (!value.accessToken || !value.phoneNumberId)
      throw new BadRequestException('Configure el token y Phone Number ID');
    const response = await fetch(
      `https://graph.facebook.com/${value.graphApiVersion}/${value.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${value.accessToken}` } },
    );
    const body = (await response.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!response.ok)
      throw new BadRequestException(
        body.error?.message || `Meta HTTP ${response.status}`,
      );
    return {
      ok: true,
      displayPhoneNumber: body.display_phone_number,
      verifiedName: body.verified_name,
    };
  }

  async notifyPlayerAccess(input: {
    user: { id: string; name: string; phone: string };
    accessToken: string;
  }): Promise<string> {
    return (await this.sendPlayerAccess(input)).accessLink;
  }

  async sendPlayerAccess(input: {
    user: { id: string; name: string; phone: string };
    accessToken: string;
  }) {
    const settings = await this.settings();
    const link = this.playerAccessLink(
      input.accessToken,
      settings.publicAppUrl,
    );
    const delivery = await this.send({
      kind: 'PLAYER_ACCESS',
      recipient: input.user.phone,
      templateName: settings.playerAccessTemplate,
      parameters: [input.user.name, link],
      idempotencyKey: `player-access:${input.user.id}:${Date.now()}`,
      userId: input.user.id,
    });
    return {
      accessLink: link,
      status: delivery.status,
      error: delivery.error,
    };
  }

  async notifyAssignment(input: {
    user: { id: string; name: string; phone: string };
    cardNumbers: number[];
  }) {
    const settings = await this.settings();
    return this.send({
      kind: 'CARD_ASSIGNMENT',
      recipient: input.user.phone,
      templateName: settings.cardAssignmentTemplate,
      parameters: [input.user.name, input.cardNumbers.join(', ')],
      idempotencyKey: `assignment:${input.user.id}:${input.cardNumbers.join('-')}`,
      userId: input.user.id,
    });
  }

  playerAccessLink(accessToken: string, baseUrl: string): string {
    return `${baseUrl.replace(/\/$/, '')}/player?token=${encodeURIComponent(accessToken)}`;
  }

  async accessLink(accessToken: string): Promise<string> {
    const stored = await this.prisma.whatsAppSettings.findUnique({
      where: { id: 1 },
      select: { publicAppUrl: true },
    });
    const publicAppUrl =
      stored?.publicAppUrl ||
      this.config.get<string>('PUBLIC_APP_URL', 'http://127.0.0.1:3000');
    return this.playerAccessLink(accessToken, publicAppUrl);
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
    const settings = await this.settings();
    for (const winner of input.winners) {
      if (!winner.card.user.phone) continue;
      await this.send({
        kind: 'WINNER_PLAYER',
        recipient: winner.card.user.phone,
        templateName: settings.winnerPlayerTemplate,
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
    const contacts = settings.fundContacts
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);
    for (const phone of contacts) {
      await this.send({
        kind: 'WINNER_CONTACT',
        recipient: phone,
        templateName: settings.winnerFundTemplate,
        parameters: [input.game.name, summary],
        idempotencyKey: `winner-contact:${input.game.id}:${phone}:${input.winners.map((winner) => winner.id).join('-')}`,
        gameId: input.game.id,
      });
    }
  }

  async retryDelivery(id: string) {
    const delivery = await this.prisma.whatsAppDelivery.findUnique({
      where: { id },
    });
    if (!delivery) throw new NotFoundException('No se encontró el envío');
    const payload = delivery.payload as {
      parameters?: unknown;
      group?: unknown;
    };
    if (
      !Array.isArray(payload.parameters) ||
      !payload.parameters.every((value) => typeof value === 'string')
    ) {
      throw new BadRequestException('El envío no tiene un contenido válido');
    }
    await this.send({
      kind: delivery.kind,
      recipient: delivery.recipient,
      templateName: delivery.templateName,
      parameters: payload.parameters,
      idempotencyKey: delivery.idempotencyKey,
      userId: delivery.userId ?? undefined,
      gameId: delivery.gameId ?? undefined,
      winnerId: delivery.winnerId ?? undefined,
      group: payload.group === true,
    });
    const retried = await this.prisma.whatsAppDelivery.findUnique({
      where: { id },
    });
    if (retried?.status !== 'SENT') {
      throw new BadRequestException(
        retried?.error ||
          'No fue posible enviar el mensaje. Revisa la configuración de WhatsApp',
      );
    }
    return retried;
  }

  private async send(message: TemplateMessage) {
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
    if (delivery.status === 'SENT') return delivery;

    const settings = await this.settings();
    const token = settings.accessToken;
    const phoneNumberId = settings.phoneNumberId;
    if (!token || !phoneNumberId) return delivery;

    try {
      const version = settings.graphApiVersion;
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
                code: settings.templateLanguage,
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
      return await this.prisma.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SENT',
          attempts: { increment: 1 },
          providerMessageId: body.messages?.[0]?.id,
          error: null,
        },
      });
    } catch (error: unknown) {
      return await this.prisma.whatsAppDelivery.update({
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
