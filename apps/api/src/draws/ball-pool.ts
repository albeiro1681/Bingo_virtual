const BALL_COUNT = 75;

export function availableBallNumbers(drawnNumbers: Iterable<number>): number[] {
  const drawn = new Set(drawnNumbers);
  return Array.from({ length: BALL_COUNT }, (_, index) => index + 1).filter(
    (number) => !drawn.has(number),
  );
}
