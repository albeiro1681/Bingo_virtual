import type { BingoCell } from '../bingo/bingo-engine';

const BOARD_SIZE = 5;
const NUMBERS_PER_COLUMN = 15;

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
