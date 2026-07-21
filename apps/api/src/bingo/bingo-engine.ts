export type BingoCell = {
  row: number;
  column: number;
  number: number | null;
  isFree: boolean;
};

export type WinningPattern =
  'ROW' | 'COLUMN' | 'DIAGONAL' | 'FOUR_CORNERS' | 'FULL_CARD' | 'CUSTOM';

export type PatternPosition = { row: number; column: number };

const BOARD_SIZE = 5;

export function matchesCustomPattern(
  cells: readonly BingoCell[],
  drawnNumbers: ReadonlySet<number>,
  requiredCells: readonly PatternPosition[],
): boolean {
  if (cells.length !== BOARD_SIZE * BOARD_SIZE) {
    throw new Error('A bingo card must contain exactly 25 cells');
  }
  if (requiredCells.length === 0)
    throw new Error('A figure must contain cells');

  return requiredCells.every(({ row, column }) => {
    const cell = cells.find(
      (candidate) => candidate.row === row && candidate.column === column,
    );
    if (!cell) throw new Error(`Missing cell at row ${row}, column ${column}`);
    return (
      cell.isFree || (cell.number !== null && drawnNumbers.has(cell.number))
    );
  });
}

export function findWinningPatterns(
  cells: readonly BingoCell[],
  drawnNumbers: ReadonlySet<number>,
): WinningPattern[] {
  if (cells.length !== BOARD_SIZE * BOARD_SIZE) {
    throw new Error('A bingo card must contain exactly 25 cells');
  }

  const marked = (row: number, column: number): boolean => {
    const cell = cells.find(
      (candidate) => candidate.row === row && candidate.column === column,
    );
    if (!cell) throw new Error(`Missing cell at row ${row}, column ${column}`);
    return (
      cell.isFree || (cell.number !== null && drawnNumbers.has(cell.number))
    );
  };

  const winners = new Set<WinningPattern>();

  for (let index = 0; index < BOARD_SIZE; index += 1) {
    if (
      Array.from({ length: BOARD_SIZE }, (_, column) =>
        marked(index, column),
      ).every(Boolean)
    ) {
      winners.add('ROW');
    }
    if (
      Array.from({ length: BOARD_SIZE }, (_, row) => marked(row, index)).every(
        Boolean,
      )
    ) {
      winners.add('COLUMN');
    }
  }

  const indexes = Array.from({ length: BOARD_SIZE }, (_, index) => index);
  if (
    indexes.every((index) => marked(index, index)) ||
    indexes.every((index) => marked(index, BOARD_SIZE - 1 - index))
  ) {
    winners.add('DIAGONAL');
  }

  if (
    marked(0, 0) &&
    marked(0, BOARD_SIZE - 1) &&
    marked(BOARD_SIZE - 1, 0) &&
    marked(BOARD_SIZE - 1, BOARD_SIZE - 1)
  ) {
    winners.add('FOUR_CORNERS');
  }

  if (
    cells.every(
      (cell) =>
        cell.isFree || (cell.number !== null && drawnNumbers.has(cell.number)),
    )
  ) {
    winners.add('FULL_CARD');
  }

  return [...winners];
}
