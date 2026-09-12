import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { generateAccessToken, hashAccessToken } from '../auth/token';
import { CreatePlayerDto } from './dto/create-player.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { decryptSecret, encryptSecret } from '../auth/secret-box';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { ImportPlayerRowDto } from './dto/import-players.dto';
import { normalizeColombianPhone } from './colombian-phone';

type ImportErrorCode =
  | 'NAME_REQUIRED'
  | 'INVALID_PHONE'
  | 'DUPLICATE_USER'
  | 'DUPLICATE_PHONE_FILE'
  | 'DUPLICATE_CARD'
  | 'DUPLICATE_CARD_FILE'
  | 'CARD_NOT_FOUND'
  | 'CARD_OCCUPIED';

type ImportRowResult = {
  line: number;
  name: string;
  phone: string | null;
  cardNumbers: number[];
  valid: boolean;
  errors: Array<{ code: ImportErrorCode; message: string }>;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): string {
    const value = this.config.get<string>('APP_ENCRYPTION_KEY');
    if (!value || value.length < 32)
      throw new Error('APP_ENCRYPTION_KEY must contain at least 32 characters');
    return value;
  }

  async createPlayer(dto: CreatePlayerDto) {
    const accessToken = generateAccessToken();
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone,
        tokenHash: hashAccessToken(accessToken),
        tokenEncrypted: encryptSecret(accessToken, this.encryptionKey()),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        cards: {
          select: { id: true, number: true, serial: true, createdAt: true },
          orderBy: { number: 'asc' },
        },
      },
    });
    const accessLink = await this.whatsapp
      .notifyPlayerAccess({
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone!,
        },
        accessToken,
      })
      .catch(() => this.whatsapp.accessLink(accessToken));
    return { ...user, accessToken, accessLink };
  }

  listPlayers() {
    return this.prisma.user.findMany({
      where: { role: 'PLAYER' },
      select: {
        id: true,
        name: true,
        phone: true,
        active: true,
        createdAt: true,
        cards: {
          select: { id: true, number: true, serial: true, createdAt: true },
          orderBy: { number: 'asc' },
        },
        whatsappDeliveries: {
          where: { kind: 'PLAYER_ACCESS' },
          select: { id: true, status: true, updatedAt: true, error: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePlayer(id: string, dto: UpdatePlayerDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, role: 'PLAYER' },
    });
    if (!existing) throw new NotFoundException('Player not found');
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
      select: { id: true, name: true, phone: true, active: true },
    });
  }

  private async playerWithToken(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'PLAYER' },
      select: { id: true, name: true, phone: true, tokenEncrypted: true },
    });
    if (!user) throw new NotFoundException('Player not found');
    if (!user.tokenEncrypted) return null;
    return {
      ...user,
      accessToken: decryptSecret(user.tokenEncrypted, this.encryptionKey()),
    };
  }

  async getAccessLink(id: string) {
    const user = await this.playerWithToken(id);
    if (!user) return this.regenerateAccessLink(id);
    return { accessLink: await this.whatsapp.accessLink(user.accessToken) };
  }

  async regenerateAccessLink(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'PLAYER' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Player not found');
    const accessToken = generateAccessToken();
    await this.prisma.user.update({
      where: { id },
      data: {
        tokenHash: hashAccessToken(accessToken),
        tokenEncrypted: encryptSecret(accessToken, this.encryptionKey()),
      },
    });
    return { accessLink: await this.whatsapp.accessLink(accessToken) };
  }

  async sendAccessLink(
    id: string,
    options?: { phone?: string; requestId?: string },
  ) {
    let user = await this.playerWithToken(id);
    if (!user) {
      await this.regenerateAccessLink(id);
      user = await this.playerWithToken(id);
    }
    if (!user?.phone) throw new NotFoundException('Player phone not found');
    const recipient = options?.phone ?? user.phone;
    const delivery = await this.whatsapp.sendPlayerAccess({
      user: { id: user.id, name: user.name, phone: user.phone },
      accessToken: user.accessToken,
      recipient,
      idempotencyKey: options?.requestId
        ? `player-access-manual:${user.id}:${options.requestId}:${recipient}`
        : undefined,
    });
    return delivery;
  }

  async previewImport(rows: ImportPlayerRowDto[]) {
    const normalizedPhones = rows
      .map((row) => normalizeColombianPhone(row.phone))
      .filter((phone): phone is string => Boolean(phone));
    const allCardNumbers = [...new Set(rows.flatMap((row) => row.cardNumbers))];
    const [existingUsers, templates] = await Promise.all([
      this.prisma.user.findMany({
        where: { phone: { in: normalizedPhones } },
        select: { phone: true },
      }),
      this.prisma.cardTemplate.findMany({
        where: { number: { in: allCardNumbers } },
        select: {
          number: true,
          card: { select: { user: { select: { name: true } } } },
        },
      }),
    ]);
    const existingPhones = new Set(existingUsers.map((user) => user.phone));
    const templatesByNumber = new Map(
      templates.map((template) => [template.number, template]),
    );
    const phoneCounts = new Map<string, number>();
    const cardCounts = new Map<number, number>();
    for (const phone of normalizedPhones)
      phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
    for (const row of rows)
      for (const number of new Set(row.cardNumbers))
        cardCounts.set(number, (cardCounts.get(number) ?? 0) + 1);

    const results: ImportRowResult[] = rows.map((row) => {
      const name = row.name.trim().replace(/\s+/g, ' ');
      const phone = normalizeColombianPhone(row.phone);
      const cardNumbers = row.cardNumbers;
      const errors: ImportRowResult['errors'] = [];
      if (!name)
        errors.push({
          code: 'NAME_REQUIRED',
          message: 'El nombre es obligatorio.',
        });
      if (!phone)
        errors.push({
          code: 'INVALID_PHONE',
          message: 'El celular colombiano no es válido.',
        });
      else {
        if (existingPhones.has(phone))
          errors.push({
            code: 'DUPLICATE_USER',
            message: 'Ya existe un jugador con este celular.',
          });
        if ((phoneCounts.get(phone) ?? 0) > 1)
          errors.push({
            code: 'DUPLICATE_PHONE_FILE',
            message: 'El celular está repetido en el archivo.',
          });
      }
      const duplicates = [
        ...new Set(
          cardNumbers.filter(
            (number, index) => cardNumbers.indexOf(number) !== index,
          ),
        ),
      ];
      if (duplicates.length)
        errors.push({
          code: 'DUPLICATE_CARD',
          message: `Cartones repetidos en la fila: ${duplicates.join(', ')}.`,
        });
      for (const number of new Set(cardNumbers)) {
        const template = templatesByNumber.get(number);
        if (!template)
          errors.push({
            code: 'CARD_NOT_FOUND',
            message: `El cartón ${number} no existe.`,
          });
        else if (template.card)
          errors.push({
            code: 'CARD_OCCUPIED',
            message: `El cartón ${number} pertenece a ${template.card.user.name}.`,
          });
        if ((cardCounts.get(number) ?? 0) > 1)
          errors.push({
            code: 'DUPLICATE_CARD_FILE',
            message: `El cartón ${number} aparece en otra fila.`,
          });
      }
      return {
        line: row.line,
        name,
        phone,
        cardNumbers,
        valid: errors.length === 0,
        errors,
      };
    });
    const validRows = results.filter((row) => row.valid);
    const invalidRows = results.filter((row) => !row.valid);
    return {
      validRows,
      invalidRows,
      rows: results,
      summary: {
        total: results.length,
        valid: validRows.length,
        invalid: invalidRows.length,
        validUsers: validRows.length,
        invalidUsers: invalidRows.length,
        cardsToAssign: validRows.reduce(
          (total, row) => total + row.cardNumbers.length,
          0,
        ),
      },
    };
  }

  async importPlayers(rows: ImportPlayerRowDto[]) {
    const preview = await this.previewImport(rows);
    const results: Array<{
      line: number;
      success: boolean;
      userId?: string;
      errors?: string[];
    }> = [];
    for (const row of preview.rows) {
      if (!row.valid || !row.phone) {
        results.push({
          line: row.line,
          success: false,
          errors: row.errors.map((error) => error.message),
        });
        continue;
      }
      try {
        const user = await this.prisma.$transaction(
          async (tx) => {
            const [duplicate, templates] = await Promise.all([
              tx.user.findUnique({
                where: { phone: row.phone! },
                select: { id: true },
              }),
              tx.cardTemplate.findMany({
                where: { number: { in: row.cardNumbers } },
                include: { cells: true, card: true },
              }),
            ]);
            if (duplicate)
              throw new ConflictException(
                'Ya existe un jugador con este celular.',
              );
            if (templates.length !== row.cardNumbers.length)
              throw new ConflictException('Uno o más cartones no existen.');
            const occupied = templates.filter((template) => template.card);
            if (occupied.length)
              throw new ConflictException(
                `Cartones ocupados: ${occupied.map((item) => item.number).join(', ')}.`,
              );
            const accessToken = generateAccessToken();
            const created = await tx.user.create({
              data: {
                name: row.name,
                phone: row.phone,
                tokenHash: hashAccessToken(accessToken),
                tokenEncrypted: encryptSecret(
                  accessToken,
                  this.encryptionKey(),
                ),
              },
              select: { id: true },
            });
            for (const template of templates) {
              const card = await tx.card.create({
                data: {
                  serial: `FECSUPOL-${String(template.number).padStart(3, '0')}`,
                  number: template.number,
                  templateId: template.id,
                  userId: created.id,
                  cells: {
                    create: template.cells.map(
                      ({ row, column, number, isFree }) => ({
                        row,
                        column,
                        number,
                        isFree,
                      }),
                    ),
                  },
                },
              });
              await tx.cardAssignmentAudit.create({
                data: {
                  cardId: card.id,
                  cardNumber: template.number,
                  newUserId: created.id,
                  action: 'ASSIGNED',
                },
              });
            }
            return created;
          },
          { isolationLevel: 'Serializable' },
        );
        results.push({ line: row.line, success: true, userId: user.id });
      } catch (error) {
        results.push({
          line: row.line,
          success: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'No fue posible importar el jugador.',
          ],
        });
      }
    }
    return {
      results,
      imported: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
    };
  }

  async sendAccessLinks(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds }, role: 'PLAYER' },
      select: {
        id: true,
        name: true,
        phone: true,
        active: true,
        _count: { select: { cards: true } },
      },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    const results: Array<{
      userId: string;
      name?: string;
      status: 'SENT' | 'FAILED' | 'SKIPPED';
      reason?: string;
    }> = [];
    for (const userId of uniqueIds) {
      const user = byId.get(userId);
      if (!user) {
        results.push({
          userId,
          status: 'SKIPPED',
          reason: 'Jugador no encontrado.',
        });
        continue;
      }
      if (!user.active || !user.phone || !normalizeColombianPhone(user.phone)) {
        results.push({
          userId,
          name: user.name,
          status: 'SKIPPED',
          reason:
            'El jugador no tiene un celular colombiano válido o está inactivo.',
        });
        continue;
      }
      if (user._count.cards === 0) {
        results.push({
          userId,
          name: user.name,
          status: 'SKIPPED',
          reason: 'El jugador no tiene cartones asignados.',
        });
        continue;
      }
      try {
        const delivery = await this.sendAccessLink(user.id);
        results.push({
          userId,
          name: user.name,
          status: delivery.status === 'SENT' ? 'SENT' : 'FAILED',
          ...(delivery.status === 'SENT'
            ? {}
            : { reason: delivery.error ?? 'WhatsApp no confirmó el envío.' }),
        });
      } catch (error) {
        results.push({
          userId,
          name: user.name,
          status: 'FAILED',
          reason:
            error instanceof Error
              ? error.message
              : 'No fue posible enviar el enlace.',
        });
      }
    }
    return {
      total: uniqueIds.length,
      sent: results.filter((item) => item.status === 'SENT').length,
      failed: results.filter((item) => item.status === 'FAILED').length,
      skipped: results.filter((item) => item.status === 'SKIPPED').length,
      results,
    };
  }
}
