import {
  BingoCell,
  findWinningPatterns,
  matchesCustomPattern,
} from './bingo-engine';

function buildCard(): BingoCell[] {
  return Array.from({ length: 25 }, (_, index) => ({
    row: Math.floor(index / 5),
    column: index % 5,
    number: index + 1,
    isFree: false,
  }));
}

describe('findWinningPatterns', () => {
  it('detects a completed row from backend draw data', () => {
    const patterns = findWinningPatterns(buildCard(), new Set([1, 2, 3, 4, 5]));

    expect(patterns).toContain('ROW');
    expect(patterns).not.toContain('FULL_CARD');
  });

  it('counts the center free space without requiring a drawn number', () => {
    const card = buildCard().map((cell) =>
      cell.row === 2 && cell.column === 2
        ? { ...cell, number: null, isFree: true }
        : cell,
    );

    expect(findWinningPatterns(card, new Set([1, 7, 19, 25]))).toContain(
      'DIAGONAL',
    );
  });

  it('rejects incomplete cards', () => {
    expect(() =>
      findWinningPatterns(buildCard().slice(0, 24), new Set()),
    ).toThrow('exactly 25 cells');
  });

  it('detects an arbitrary figure using only its required cells', () => {
    const card = buildCard().map((cell) =>
      cell.row === 2 && cell.column === 2
        ? { ...cell, number: null, isFree: true }
        : cell,
    );
    const cross = [
      { row: 0, column: 2 },
      { row: 1, column: 2 },
      { row: 2, column: 2 },
      { row: 3, column: 2 },
      { row: 4, column: 2 },
      { row: 2, column: 0 },
      { row: 2, column: 1 },
      { row: 2, column: 3 },
      { row: 2, column: 4 },
    ];
    const requiredNumbers = card
      .filter((cell) =>
        cross.some(
          (position) =>
            position.row === cell.row && position.column === cell.column,
        ),
      )
      .flatMap((cell) => (cell.number === null ? [] : [cell.number]));

    expect(matchesCustomPattern(card, new Set(requiredNumbers), cross)).toBe(
      true,
    );
    expect(
      matchesCustomPattern(card, new Set(requiredNumbers.slice(1)), cross),
    ).toBe(false);
  });
});
