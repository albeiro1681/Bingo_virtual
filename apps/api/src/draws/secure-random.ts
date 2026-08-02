import { randomInt } from 'node:crypto';

export function selectSecureRandom<T>(values: readonly T[]): T {
  if (values.length === 0) {
    throw new RangeError('Cannot select a value from an empty collection');
  }

  return values[randomInt(values.length)];
}
