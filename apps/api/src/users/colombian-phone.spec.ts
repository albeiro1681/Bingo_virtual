import { normalizeColombianPhone } from './colombian-phone';

describe('normalizeColombianPhone', () => {
  it.each([
    ['3001234567', '+573001234567'],
    ['573001234567', '+573001234567'],
    ['+573001234567', '+573001234567'],
    ['(300) 123-4567', '+573001234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeColombianPhone(input)).toBe(expected);
  });

  it.each(['', '2001234567', '300123456', '5730012345678', '300ABC4567'])(
    'rejects %s',
    (input) => expect(normalizeColombianPhone(input)).toBeNull(),
  );
});
