import type { BingoCell } from '../bingo/bingo-engine';

const BOARD_SIZE = 5;
const NUMBERS_PER_COLUMN = 15;
export const CARD_CATALOG_SIZE = 130;
export const CARD_CATALOG_SEED = 0xfec51300;

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function generateCard(random: () => number = Math.random): BingoCell[] {
  const cells: BingoCell[] = [];

  for (let column = 0; column < BOARD_SIZE; column += 1) {
    const start = column * NUMBERS_PER_COLUMN + 1;
    const candidates = Array.from(
      { length: NUMBERS_PER_COLUMN },
      (_, index) => start + index,
    );

    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [
        candidates[swapIndex],
        candidates[index],
      ];
    }

    const selected = candidates.slice(0, BOARD_SIZE).sort((a, b) => a - b);
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      const isFree = row === 2 && column === 2;
      cells.push({
        row,
        column,
        number: isFree ? null : selected[row],
        isFree,
      });
    }
  }

  return cells;
}

function shuffle<T>(values: T[], random: () => number): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function balancedColumn(
  cardCount: number,
  slotsPerCard: number,
  start: number,
  random: () => number,
): number[][] | null {
  const totalSlots = cardCount * slotsPerCard;
  const baseFrequency = Math.floor(totalSlots / NUMBERS_PER_COLUMN);
  const extraOccurrences = totalSlots % NUMBERS_PER_COLUMN;
  const quotaOrder = Array.from(
    { length: NUMBERS_PER_COLUMN },
    (_, index) => index,
  );
  shuffle(quotaOrder, random);

  const remaining = Array.from(
    { length: NUMBERS_PER_COLUMN },
    (_, index) =>
      baseFrequency + (quotaOrder.indexOf(index) < extraOccurrences ? 1 : 0),
  );
  const cards: number[][] = [];

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
    const selected: number[] = [];
    for (let slot = 0; slot < slotsPerCard; slot += 1) {
      const candidates = remaining
        .map((count, index) => ({ count, index, tie: random() }))
        .filter(({ count, index }) => count > 0 && !selected.includes(index))
        .sort(
          (left, right) => right.count - left.count || left.tie - right.tie,
        );
      if (candidates.length === 0) return null;
      const highestQuota = candidates[0].count;
      const equallyNeeded = candidates.filter(
        ({ count }) => count === highestQuota,
      );
      const choice = equallyNeeded[Math.floor(random() * equallyNeeded.length)];
      selected.push(choice.index);
      remaining[choice.index] -= 1;
    }
    cards.push(selected.map((index) => start + index).sort((a, b) => a - b));
  }

  return remaining.every((count) => count === 0) ? cards : null;
}

function buildCatalog(cardCount: number, seed: number): BingoCell[][] | null {
  const random = seededRandom(seed);
  const columns = Array.from({ length: BOARD_SIZE }, (_, column) =>
    balancedColumn(
      cardCount,
      column === 2 ? BOARD_SIZE - 1 : BOARD_SIZE,
      column * NUMBERS_PER_COLUMN + 1,
      random,
    ),
  );
  if (columns.some((column) => column === null)) return null;

  const catalog = Array.from({ length: cardCount }, (_, cardIndex) => {
    const cells: BingoCell[] = [];
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const numbers = columns[column]![cardIndex];
      let numberIndex = 0;
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        const isFree = row === 2 && column === 2;
        cells.push({
          row,
          column,
          number: isFree ? null : numbers[numberIndex++],
          isFree,
        });
      }
    }
    return cells;
  });
  const signatures = catalog.map((card) =>
    card.map((cell) => cell.number ?? 0).join(','),
  );
  return new Set(signatures).size === cardCount ? catalog : null;
}

export function generateCardCatalog(
  cardCount = CARD_CATALOG_SIZE,
  seed = CARD_CATALOG_SEED,
): BingoCell[][] {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const catalog = buildCatalog(cardCount, seed + attempt);
    if (catalog) return catalog;
  }
  throw new Error('Could not build a unique and balanced card catalog');
}
