import { generateAccessToken, hashAccessToken } from './token';

describe('access tokens', () => {
  it('generates distinct high-entropy tokens', () => {
    const first = generateAccessToken();
    const second = generateAccessToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it('hashes tokens deterministically without storing the original value', () => {
    const token = 'private-token';
    const hash = hashAccessToken(token);

    expect(hash).toBe(hashAccessToken(token));
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
  });
});
