import {
  CARD_CATALOG_SIZE,
  CARD_CATALOG_SEED,
  generateCard,
  generateCardCatalog,
} from './card-generator';

describe('generateCard', () => {
  it('generates a 5x5 card with a free center', () => {
    const cells = generateCard(() => 0.5);
    const center = cells.find((cell) => cell.row === 2 && cell.column === 2);

    expect(cells).toHaveLength(25);
    expect(center).toEqual({ row: 2, column: 2, number: null, isFree: true });
  });

  it('uses the correct B-I-N-G-O ranges without duplicate numbers', () => {
    const cells = generateCard(() => 0.37);

    for (let column = 0; column < 5; column += 1) {
      const numbers = cells
        .filter((cell) => cell.column === column && cell.number !== null)
        .map((cell) => cell.number as number);
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers.every((number) => number >= column * 15 + 1)).toBe(true);
      expect(numbers.every((number) => number <= (column + 1) * 15)).toBe(true);
    }
  });

  it('does not automatically sort the selected numbers within columns', () => {
    const cells = generateCard(seededSequence());
    const columns = Array.from({ length: 5 }, (_, column) =>
      cells
        .filter((cell) => cell.column === column && cell.number !== null)
        .map((cell) => cell.number as number),
    );

    expect(columns.some((numbers) => !isOrdered(numbers))).toBe(true);
  });
});

describe('generateCardCatalog', () => {
  it('generates 130 structurally valid and unique cards', () => {
    const catalog = generateCardCatalog();

    expect(catalog).toHaveLength(CARD_CATALOG_SIZE);
    const signatures = new Set<string>();
    for (const card of catalog) {
      expect(card).toHaveLength(25);
      const center = card.find((cell) => cell.row === 2 && cell.column === 2);
      expect(center).toEqual({
        row: 2,
        column: 2,
        number: null,
        isFree: true,
      });
      const numbers = card.flatMap((cell) =>
        cell.number === null ? [] : [cell.number],
      );
      expect(numbers).toHaveLength(24);
      expect(new Set(numbers).size).toBe(24);

      for (let column = 0; column < 5; column += 1) {
        const columnNumbers = card
          .filter((cell) => cell.column === column && cell.number !== null)
          .map((cell) => cell.number as number);
        expect(
          columnNumbers.every(
            (number) =>
              number >= column * 15 + 1 && number <= (column + 1) * 15,
          ),
        ).toBe(true);
      }
      signatures.add(card.map((cell) => cell.number ?? 0).join(','));
    }
    expect(signatures.size).toBe(CARD_CATALOG_SIZE);
  });

  it('distributes every number uniformly within its B-I-N-G-O column', () => {
    const catalog = generateCardCatalog();
    const frequencies = new Map<number, number>();
    for (const cell of catalog.flat()) {
      if (cell.number !== null) {
        frequencies.set(cell.number, (frequencies.get(cell.number) ?? 0) + 1);
      }
    }

    for (let column = 0; column < 5; column += 1) {
      const expected = column === 2 ? [34, 35] : [43, 44];
      const columnFrequencies = Array.from(
        { length: 15 },
        (_, index) => frequencies.get(column * 15 + index + 1) ?? 0,
      );
      expect(columnFrequencies.every((count) => expected.includes(count))).toBe(
        true,
      );
      expect(
        Math.max(...columnFrequencies) - Math.min(...columnFrequencies),
      ).toBeLessThanOrEqual(1);
    }
  });

  it('reproduces the same immutable catalog from the configured seed', () => {
    expect(generateCardCatalog(CARD_CATALOG_SIZE, CARD_CATALOG_SEED)).toEqual(
      generateCardCatalog(CARD_CATALOG_SIZE, CARD_CATALOG_SEED),
    );
    expect(
      generateCardCatalog(CARD_CATALOG_SIZE, CARD_CATALOG_SEED + 1),
    ).not.toEqual(generateCardCatalog(CARD_CATALOG_SIZE, CARD_CATALOG_SEED));
  });

  it('places catalog numbers in non-ordered positions', () => {
    const catalog = generateCardCatalog();
    const columns = catalog.flatMap((card) =>
      Array.from({ length: 5 }, (_, column) =>
        card
          .filter((cell) => cell.column === column && cell.number !== null)
          .map((cell) => cell.number as number),
      ),
    );

    expect(columns.filter(isOrdered).length).toBeLessThan(columns.length / 10);
  });
});

function isOrdered(numbers: number[]): boolean {
  const ascending = numbers.every(
    (number, index) => index === 0 || numbers[index - 1] < number,
  );
  const descending = numbers.every(
    (number, index) => index === 0 || numbers[index - 1] > number,
  );
  return ascending || descending;
}

function seededSequence(): () => number {
  const values = [0.13, 0.81, 0.27, 0.64, 0.42, 0.95, 0.08];
  let index = 0;
  return () => values[index++ % values.length];
}
