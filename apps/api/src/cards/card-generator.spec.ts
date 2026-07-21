import { generateCard } from './card-generator';

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
});
