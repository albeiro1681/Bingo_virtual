import { availableBallNumbers } from './ball-pool';

describe('availableBallNumbers', () => {
  it('returns each undrawn bingo ball exactly once', () => {
    const available = availableBallNumbers([1, 15, 29, 44, 60, 75]);

    expect(available).toHaveLength(69);
    expect(new Set(available)).toHaveProperty('size', available.length);
    expect(available).not.toEqual(
      expect.arrayContaining([1, 15, 29, 44, 60, 75]),
    );
  });
});
