import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  findWinningPatterns,
  matchesCustomPattern,
  type WinningPattern,
} from '../bingo/bingo-engine';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { DrawsGateway } from './draws.gateway';
import { availableBallNumbers } from './ball-pool';
import { selectSecureRandom } from './secure-random';

const MAX_TRANSACTION_RETRIES = 5;
const RETRYABLE_TRANSACTION_CODES = new Set(['P2002', 'P2034']);

@Injectable()
export class DrawsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DrawsGateway,
    private readonly whatsapp: WhatsAppService,
  ) {}

  activePlayers() {
    return this.gateway.activePlayers();
  }

  async draw(gameId: string) {
    const result = await this.withTransactionRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const [game, cards] = await Promise.all([
            tx.game.findUnique({
              where: { id: gameId },
              include: {
                drawnBalls: { orderBy: { drawOrder: 'asc' } },
                winningCells: true,
              },
            }),
            tx.card.findMany({ include: { cells: true } }),
          ]);
          if (!game) throw new NotFoundException('Game not found');
          if (game.status !== 'ACTIVE') {
            throw new ConflictException(
              'Balls can only be drawn for an active game',
            );
          }
          const winningType = String(game.winningType) as WinningPattern;

          const drawn = new Set(game.drawnBalls.map((ball) => ball.number));
          const available = availableBallNumbers(drawn);
          if (available.length === 0) {
            throw new ConflictException('All balls have already been drawn');
          }

          const number = selectSecureRandom(available);
          const ball = await tx.drawnBall.create({
            data: {
              gameId,
              number,
              drawOrder: game.drawnBalls.length + 1,
            },
          });

          drawn.add(number);
          const winningCards = cards.filter((card) =>
            winningType === 'CUSTOM'
              ? matchesCustomPattern(card.cells, drawn, game.winningCells)
              : findWinningPatterns(card.cells, drawn).includes(winningType),
          );
          const winningCardsByPlayer = new Map<
            string,
            (typeof winningCards)[number]
          >();
          for (const card of winningCards) {
            const current = winningCardsByPlayer.get(card.userId);
            if (!current || card.number < current.number) {
              winningCardsByPlayer.set(card.userId, card);
            }
          }
          const playerWinningCards = [...winningCardsByPlayer.values()];
          const definitiveCard =
            playerWinningCards.length === 1 ? playerWinningCards[0] : null;
          const tied = playerWinningCards.length > 1;
          if (tied) {
            await tx.tieBreakCandidate.createMany({
              data: playerWinningCards.map((card) => ({
                gameId,
                cardId: card.id,
              })),
              skipDuplicates: true,
            });
          }

          const finished = winningCards.length > 0 || available.length === 1;
          const updatedGame = finished
            ? await tx.game.update({
                where: { id: gameId },
                data: {
                  status: tied ? 'TIE_BREAK' : 'FINISHED',
                  finishedAt: tied ? null : new Date(),
                  finalWinnerId: definitiveCard?.id,
                  endedManually: false,
                },
                select: {
                  id: true,
                  name: true,
                  status: true,
                  winningType: true,
                  startedAt: true,
                  finishedAt: true,
                  endedManually: true,
                  finalWinnerId: true,
                  prizeAmount: true,
                  currencyCode: true,
                },
              })
            : {
                id: game.id,
                name: game.name,
                status: game.status,
                winningType,
                startedAt: game.startedAt,
                finishedAt: game.finishedAt,
                endedManually: game.endedManually,
                finalWinnerId: game.finalWinnerId,
                prizeAmount: game.prizeAmount,
                currencyCode: game.currencyCode,
              };

          const winner = definitiveCard
            ? await tx.winner.upsert({
                where: {
                  gameId_cardId_type: {
                    gameId,
                    cardId: definitiveCard.id,
                    type: winningType,
                  },
                },
                create: {
                  gameId,
                  cardId: definitiveCard.id,
                  playerId: definitiveCard.userId,
                  type: winningType,
                  prizeAmount: game.prizeAmount,
                  currencyCode: game.currencyCode,
                  winningBallNumber: ball.number,
                  isFinal: true,
                },
                update: {
                  playerId: definitiveCard.userId,
                  prizeAmount: game.prizeAmount,
                  currencyCode: game.currencyCode,
                  winningBallNumber: ball.number,
                  isFinal: true,
                },
                include: {
                  card: {
                    include: {
                      user: { select: { id: true, name: true, phone: true } },
                    },
                  },
                },
              })
            : null;
          const winners = winner ? [winner] : [];

          return { ball, winners, game: updatedGame, tied };
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    this.gateway.ballDrawn(result.ball);
    if (result.winners.length > 0) this.gateway.winnersDetected(result.winners);
    this.gateway.gameUpdated(result.game);
    if (result.winners.length === 1) {
      void this.whatsapp
        .notifyWinners({ game: result.game, winners: result.winners })
        .catch(() => undefined);
    }
    return result;
  }

  async breakTie(gameId: string) {
    const result = await this.withTransactionRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const game = await tx.game.findUnique({
            where: { id: gameId },
            include: {
              tieBreakCandidates: {
                include: {
                  card: {
                    include: {
                      user: { select: { id: true, name: true, phone: true } },
                    },
                  },
                },
                orderBy: { card: { number: 'asc' } },
              },
            },
          });
          if (!game) throw new NotFoundException('Game not found');
          if (game.status !== 'TIE_BREAK' || game.finalWinnerId) {
            throw new ConflictException('This game has no pending tie-break');
          }
          if (game.tieBreakCandidates.length < 2) {
            throw new ConflictException(
              'A tie-break requires at least two candidate cards',
            );
          }

          const selected = selectSecureRandom(game.tieBreakCandidates);
          const winner = await tx.winner.upsert({
            where: {
              gameId_cardId_type: {
                gameId,
                cardId: selected.cardId,
                type: game.winningType,
              },
            },
            create: {
              gameId,
              cardId: selected.cardId,
              playerId: selected.card.user.id,
              type: game.winningType,
              prizeAmount: game.prizeAmount,
              currencyCode: game.currencyCode,
              isFinal: true,
            },
            update: {
              playerId: selected.card.user.id,
              prizeAmount: game.prizeAmount,
              currencyCode: game.currencyCode,
              isFinal: true,
            },
            include: {
              card: {
                include: {
                  user: { select: { id: true, name: true, phone: true } },
                },
              },
            },
          });

          const updatedGame = await tx.game.update({
            where: { id: gameId },
            data: {
              status: 'FINISHED',
              finishedAt: new Date(),
              tieBreakCompletedAt: new Date(),
              finalWinnerId: selected.cardId,
            },
            select: {
              id: true,
              name: true,
              status: true,
              winningType: true,
              startedAt: true,
              finishedAt: true,
              endedManually: true,
              finalWinnerId: true,
              tieBreakCompletedAt: true,
              prizeAmount: true,
              currencyCode: true,
            },
          });
          return {
            game: updatedGame,
            winner,
            cardNumber: selected.card.number,
          };
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    this.gateway.tieBreakCompleted(result);
    this.gateway.winnersDetected([result.winner]);
    this.gateway.gameUpdated(result.game);
    void this.whatsapp
      .notifyWinners({ game: result.game, winners: [result.winner] })
      .catch(() => undefined);
    return result;
  }

  private async withTransactionRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
      try {
        return await operation();
      } catch (error: unknown) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String(error.code)
            : undefined;
        if (
          !code ||
          !RETRYABLE_TRANSACTION_CODES.has(code) ||
          attempt === MAX_TRANSACTION_RETRIES
        )
          throw error;
      }
    }
    throw new Error('Unreachable transaction retry state');
  }
}
