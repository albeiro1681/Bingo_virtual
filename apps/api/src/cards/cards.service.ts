import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DrawsGateway } from '../draws/draws.gateway';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CARD_CATALOG_SIZE, generateCardCatalog } from './card-generator';
import { GenerateCardsDto } from './dto/generate-cards.dto';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly draws: DrawsGateway,
  ) {}

  list() {
    return this.prisma.card.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true } },
        cells: { orderBy: [{ column: 'asc' }, { row: 'asc' }] },
      },
      orderBy: { number: 'asc' },
    });
  }

  catalog() {
    return this.prisma.cardTemplate.findMany({
      include: {
        cells: { orderBy: [{ column: 'asc' }, { row: 'asc' }] },
        card: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { number: 'asc' },
    });
  }

  initializeCatalog() {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.cardTemplate.count();
        if (existing === CARD_CATALOG_SIZE)
          return { count: existing, created: false };
        if (existing !== 0) {
          throw new ConflictException(
            'The card catalog is incomplete and requires manual review',
          );
        }
        const catalog = generateCardCatalog();
        for (let number = 1; number <= CARD_CATALOG_SIZE; number += 1) {
          await tx.cardTemplate.create({
            data: {
              number,
              cells: {
                create: catalog[number - 1],
              },
            },
          });
        }
        return { count: CARD_CATALOG_SIZE, created: true };
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  }

  async generate(dto: GenerateCardsDto) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const [user, templates] = await Promise.all([
          tx.user.findUnique({ where: { id: dto.userId } }),
          tx.cardTemplate.findMany({
            where: { number: { in: dto.cardNumbers } },
            include: { cells: true },
          }),
        ]);
        if (!user || user.role !== 'PLAYER' || !user.active || !user.phone) {
          throw new NotFoundException('Active player with phone not found');
        }
        if (templates.length !== dto.cardNumbers.length) {
          throw new ConflictException(
            'One or more card numbers do not exist in the master catalog',
          );
        }
        const assigned = await tx.card.findMany({
          where: {
            templateId: { in: templates.map((card) => card.id) },
          },
          select: { number: true },
        });
        if (assigned.length > 0) {
          throw new ConflictException(
            `Cards already assigned: ${assigned.map((card) => card.number).join(', ')}`,
          );
        }

        const cards: Array<{ id: string; serial: string; number: number }> = [];
        for (const template of templates.sort((a, b) => a.number - b.number)) {
          const card = await tx.card.create({
            data: {
              serial: `FECSUPOL-${String(template.number).padStart(3, '0')}`,
              number: template.number,
              templateId: template.id,
              userId: user.id,
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
            select: { id: true, serial: true },
          });
          await tx.cardAssignmentAudit.create({
            data: {
              cardId: card.id,
              cardNumber: template.number,
              newUserId: user.id,
              action: 'ASSIGNED',
            },
          });
          cards.push({ ...card, number: template.number });
        }
        return { user, cards };
      },
      { isolationLevel: 'Serializable' },
    );

    await this.draws.cardsUpdated(result.user.id);
    await this.whatsapp
      .notifyAssignment({
        user: {
          id: result.user.id,
          name: result.user.name,
          phone: result.user.phone!,
        },
        cardNumbers: result.cards.map((card) => card.number),
      })
      .catch(() => undefined);
    return { count: result.cards.length, cards: result.cards };
  }

  async updatePlayerCards(
    userId: string,
    cardNumbers: number[],
    profile?: { name?: string; phone?: string; active?: boolean },
    sendWhatsApp = true,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const [user, current, requested, startedGames] = await Promise.all([
          tx.user.findFirst({ where: { id: userId, role: 'PLAYER' } }),
          tx.card.findMany({
            where: { userId },
            include: { template: { include: { cells: true } } },
          }),
          tx.cardTemplate.findMany({
            where: { number: { in: cardNumbers } },
            include: { cells: true, card: true },
          }),
          tx.game.count({ where: { startedAt: { not: null } } }),
        ]);
        if (!user || !(profile?.phone ?? user.phone))
          throw new NotFoundException('Player with phone not found');
        if (requested.length !== cardNumbers.length)
          throw new ConflictException('One or more card numbers do not exist');

        const desired = new Set(cardNumbers);
        const removed = current.filter((card) => !desired.has(card.number));
        const transferred = requested.filter(
          (template) => template.card && template.card.userId !== userId,
        );
        if (
          startedGames > 0 &&
          (removed.length > 0 || transferred.length > 0)
        ) {
          throw new ConflictException(
            'Assigned cards are permanently locked because a draw has already started',
          );
        }

        for (const card of removed) {
          await tx.cardAssignmentAudit.create({
            data: {
              cardId: card.id,
              cardNumber: card.number,
              previousUserId: userId,
              action: 'UNASSIGNED',
            },
          });
          await tx.card.delete({ where: { id: card.id } });
        }
        for (const template of requested.sort((a, b) => a.number - b.number)) {
          if (template.card?.userId === userId) continue;
          if (template.card) {
            await tx.cardAssignmentAudit.create({
              data: {
                cardId: template.card.id,
                cardNumber: template.number,
                previousUserId: template.card.userId,
                newUserId: userId,
                action: 'REASSIGNED',
              },
            });
            await tx.card.update({
              where: { id: template.card.id },
              data: { userId },
            });
            continue;
          }
          const card = await tx.card.create({
            data: {
              serial: `FECSUPOL-${String(template.number).padStart(3, '0')}`,
              number: template.number,
              templateId: template.id,
              userId,
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
              newUserId: userId,
              action: 'ASSIGNED',
            },
          });
        }
        const updatedUser = profile
          ? await tx.user.update({
              where: { id: userId },
              data: {
                ...(profile.name !== undefined
                  ? { name: profile.name.trim() }
                  : {}),
                ...(profile.phone !== undefined
                  ? { phone: profile.phone }
                  : {}),
                ...(profile.active !== undefined
                  ? { active: profile.active }
                  : {}),
              },
            })
          : user;
        return {
          user: updatedUser,
          cardNumbers: [...cardNumbers].sort((a, b) => a - b),
        };
      },
      { isolationLevel: 'Serializable' },
    );

    await this.draws.cardsUpdated(userId);
    const delivery = sendWhatsApp
      ? await this.whatsapp
          .notifyAssignment({
            user: {
              id: result.user.id,
              name: result.user.name,
              phone: result.user.phone!,
            },
            cardNumbers: result.cardNumbers,
          })
          .catch(() => undefined)
      : undefined;
    return {
      count: result.cardNumbers.length,
      cardNumbers: result.cardNumbers,
      whatsappStatus: sendWhatsApp ? (delivery?.status ?? 'FAILED') : 'SKIPPED',
    };
  }

  async resendPlayerCards(userId: string, cardNumbers: number[]) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: 'PLAYER', active: true },
      select: {
        id: true,
        name: true,
        phone: true,
        cards: {
          where: { number: { in: cardNumbers } },
          select: { number: true },
        },
      },
    });
    if (!user?.phone)
      throw new NotFoundException('Active player with phone not found');
    if (user.cards.length !== cardNumbers.length)
      throw new ConflictException(
        'One or more cards do not belong to this player',
      );
    const delivery = await this.whatsapp.notifyAssignment({
      user: { id: user.id, name: user.name, phone: user.phone },
      cardNumbers: [...cardNumbers].sort((a, b) => a - b),
    });
    return { status: delivery.status, cardNumbers };
  }
}
