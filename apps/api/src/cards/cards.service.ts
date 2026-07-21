import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateAccessToken, hashAccessToken } from '../auth/token';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { generateCard, seededRandom } from './card-generator';
import { GenerateCardsDto } from './dto/generate-cards.dto';

const CARD_CATALOG_SIZE = 120;

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
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
        for (let number = 1; number <= CARD_CATALOG_SIZE; number += 1) {
          await tx.cardTemplate.create({
            data: {
              number,
              cells: {
                create: generateCard(seededRandom(0xfec50000 + number)),
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
    const accessToken = generateAccessToken();
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

        await tx.user.update({
          where: { id: user.id },
          data: { tokenHash: hashAccessToken(accessToken) },
        });
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
          cards.push({ ...card, number: template.number });
        }
        return { user, cards };
      },
      { isolationLevel: 'Serializable' },
    );

    await this.whatsapp.notifyAssignment({
      user: {
        id: result.user.id,
        name: result.user.name,
        phone: result.user.phone!,
      },
      cardNumbers: result.cards.map((card) => card.number),
      accessToken,
    });
    return { count: result.cards.length, cards: result.cards };
  }
}
