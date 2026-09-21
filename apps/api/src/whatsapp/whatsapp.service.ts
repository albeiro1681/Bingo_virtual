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
  sensitiveParameterIndexes?: number[];
};

type ReceiptStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
const CARD_ASSIGNMENT_ACCESS_TEMPLATE = 'card_assignment_access_v1';

function receiptStatus(value: unknown): ReceiptStatus | null {
  switch (value) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'READ';
    case 'failed':
      return 'FAILED';
    default:
      return null;
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

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
    const configuredPublicAppUrl = this.config
      .get<string>('PUBLIC_APP_URL')
      ?.trim();
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
      publicAppUrl:
        configuredPublicAppUrl ||
        stored?.publicAppUrl ||
        'http://127.0.0.1:3000',
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

  async assignmentIncludesAccess(): Promise<boolean> {
    const value = await this.settings();
    return value.cardAssignmentTemplate === CARD_ASSIGNMENT_ACCESS_TEMPLATE;
  }

  async updateSettings(dto: UpdateWhatsAppSettingsDto) {
    const { accessToken } = dto;
    const data = { ...dto };
    delete data.accessToken;
    // Se aceptan, pero se ignoran, para no romper formularios antiguos que
    // pudieran seguir abiertos durante el despliegue.
    delete data.winnerFundTemplate;
    delete data.fundContacts;
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
    recipient?: string;
    idempotencyKey?: string;
  }) {
    const settings = await this.settings();
    const link = this.playerAccessLink(
      input.accessToken,
      settings.publicAppUrl,
    );
    const delivery = await this.send({
      kind: 'PLAYER_ACCESS',
      recipient: input.recipient ?? input.user.phone,
      templateName: settings.playerAccessTemplate,
      parameters: [input.user.name, link],
      sensitiveParameterIndexes: [1],
      idempotencyKey:
        input.idempotencyKey ?? `player-access:${input.user.id}:${Date.now()}`,
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
    recipient?: string;
    idempotencyKey?: string;
  }) {
    const settings = await this.settings();
    const includesAccess =
      settings.cardAssignmentTemplate === CARD_ASSIGNMENT_ACCESS_TEMPLATE;
    let accessLink: string | undefined;
    if (includesAccess) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.user.id },
        select: { tokenEncrypted: true },
      });
      if (!user?.tokenEncrypted)
        throw new BadRequestException(
          'El jugador no tiene un enlace de acceso disponible.',
        );
      accessLink = this.playerAccessLink(
        decryptSecret(user.tokenEncrypted, this.encryptionKey()),
        settings.publicAppUrl,
      );
    }
    return this.send({
      kind: 'CARD_ASSIGNMENT',
      recipient: input.recipient ?? input.user.phone,
      templateName: settings.cardAssignmentTemplate,
      parameters: [
        input.user.name,
        input.cardNumbers.join(', '),
        ...(accessLink ? [accessLink] : []),
      ],
      sensitiveParameterIndexes: includesAccess ? [2] : undefined,
      idempotencyKey:
        input.idempotencyKey ??
        `${includesAccess ? 'assignment-access' : 'assignment'}:${input.user.id}:${input.cardNumbers.join('-')}`,
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
      this.config.get<string>('PUBLIC_APP_URL')?.trim() ||
      stored?.publicAppUrl ||
      'http://127.0.0.1:3000';
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
    if (!Array.isArray(payload.parameters)) {
      throw new BadRequestException('El envío no tiene un contenido válido');
    }
    const parameters = payload.parameters.map((value: unknown) => {
      if (typeof value === 'string') return value;
      const encrypted = objectValue(value)?.encrypted;
      if (typeof encrypted === 'string')
        return decryptSecret(encrypted, this.encryptionKey());
      throw new BadRequestException('El envío no tiene un contenido válido');
    });
    await this.send(
      {
        kind: delivery.kind,
        recipient: delivery.recipient,
        templateName: delivery.templateName,
        parameters,
        idempotencyKey: delivery.idempotencyKey,
        userId: delivery.userId ?? undefined,
        gameId: delivery.gameId ?? undefined,
        winnerId: delivery.winnerId ?? undefined,
        group: payload.group === true,
      },
      true,
    );
    const retried = await this.prisma.whatsAppDelivery.findUnique({
      where: { id },
    });
    if (!retried || !['SENT', 'DELIVERED', 'READ'].includes(retried.status)) {
      throw new BadRequestException(
        retried?.error ||
          'No fue posible enviar el mensaje. Revisa la configuración de WhatsApp',
      );
    }
    return retried;
  }

  async listDeliveries() {
    const deliveries = await this.prisma.whatsAppDelivery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        kind: true,
        status: true,
        recipient: true,
        attempts: true,
        createdAt: true,
        providerStatusAt: true,
        error: true,
        user: { select: { name: true } },
      },
    });
    return deliveries.map(({ recipient, error, ...delivery }) => ({
      ...delivery,
      recipientMasked:
        recipient.length > 4 ? `••••${recipient.slice(-4)}` : '••••',
      error: error
        ? /^Meta reportó un fallo(?: \(código \d+\))?$/.test(error)
          ? error
          : 'Meta rechazó el envío o falló la conexión.'
        : null,
    }));
  }

  async recordStatusWebhook(payload: unknown): Promise<void> {
    const root = objectValue(payload);
    if (
      root?.object !== 'whatsapp_business_account' ||
      !Array.isArray(root.entry)
    )
      return;

    for (const entry of root.entry) {
      const changes = objectValue(entry)?.changes;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const statuses = objectValue(objectValue(change)?.value)?.statuses;
        if (!Array.isArray(statuses)) continue;
        for (const item of statuses) {
          const receipt = objectValue(item);
          const providerMessageId = receipt?.id;
          const status = receiptStatus(receipt?.status);
          if (
            typeof providerMessageId !== 'string' ||
            providerMessageId.length < 1 ||
            providerMessageId.length > 255 ||
            !status
          )
            continue;

          const seconds = Number(receipt?.timestamp);
          const occurredAt =
            Number.isSafeInteger(seconds) && seconds > 0
              ? new Date(seconds * 1000)
              : new Date();
          const firstError = Array.isArray(receipt?.errors)
            ? objectValue(receipt.errors[0])
            : null;
          const code = firstError?.code;
          const errorCode =
            status === 'FAILED' &&
            typeof code === 'number' &&
            Number.isSafeInteger(code)
              ? String(code)
              : null;

          await this.prisma.whatsAppStatusEvent.createMany({
            data: [{ providerMessageId, status, occurredAt, errorCode }],
            skipDuplicates: true,
          });
          await this.syncReceipt(providerMessageId);
        }
      }
    }
  }

  private async syncReceipt(providerMessageId: string): Promise<boolean> {
    const events = await this.prisma.whatsAppStatusEvent.findMany({
      where: { providerMessageId },
      select: { status: true, occurredAt: true, errorCode: true },
    });
    const rank = { SENT: 1, FAILED: 2, DELIVERED: 3, READ: 4, PENDING: 0 };
    const best = events.sort(
      (a, b) =>
        rank[b.status] - rank[a.status] ||
        b.occurredAt.getTime() - a.occurredAt.getTime(),
    )[0];
    if (!best || best.status === 'PENDING') return false;

    const lowerStatuses = {
      SENT: ['PENDING'],
      FAILED: ['PENDING', 'SENT'],
      DELIVERED: ['PENDING', 'SENT', 'FAILED'],
      READ: ['PENDING', 'SENT', 'FAILED', 'DELIVERED'],
    } as const;
    await this.prisma.whatsAppDelivery.updateMany({
      where: {
        providerMessageId,
        status: { in: [...lowerStatuses[best.status]] },
      },
      data: {
        status: best.status,
        providerStatusAt: best.occurredAt,
        error:
          best.status === 'FAILED'
            ? `Meta reportó un fallo${best.errorCode ? ` (código ${best.errorCode})` : ''}`
            : null,
      },
    });
    return true;
  }

  private async send(message: TemplateMessage, allowRetry = false) {
    const sensitiveIndexes = new Set(message.sensitiveParameterIndexes ?? []);
    const delivery = await this.prisma.whatsAppDelivery.upsert({
      where: { idempotencyKey: message.idempotencyKey },
      create: {
        kind: message.kind,
        recipient: message.recipient,
        templateName: message.templateName,
        payload: {
          parameters: message.parameters.map((value, index) =>
            sensitiveIndexes.has(index)
              ? { encrypted: encryptSecret(value, this.encryptionKey()) }
              : value,
          ),
          group: message.group ?? false,
        },
        idempotencyKey: message.idempotencyKey,
        userId: message.userId,
        gameId: message.gameId,
        winnerId: message.winnerId,
      },
      update: {},
    });
    if (
      ['SENT', 'DELIVERED', 'READ'].includes(delivery.status) ||
      (delivery.status === 'FAILED' && !allowRetry)
    )
      return delivery;

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
      const providerMessageId = body.messages?.[0]?.id;
      if (!providerMessageId)
        throw new Error('Meta no devolvió el identificador del mensaje');
      const accepted = await this.prisma.whatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SENT',
          attempts: { increment: 1 },
          providerMessageId,
          providerStatusAt: null,
          error: null,
        },
      });
      // Meta ya aceptó el mensaje. Un fallo al consultar recibos locales no
      // debe convertirlo en un fallo de envío ni provocar un reenvío.
      try {
        if (await this.syncReceipt(providerMessageId)) {
          return (
            (await this.prisma.whatsAppDelivery.findUnique({
              where: { id: delivery.id },
            })) ?? accepted
          );
        }
      } catch {
        return accepted;
      }
      return accepted;
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
