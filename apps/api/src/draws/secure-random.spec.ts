import { randomInt } from 'node:crypto';
import { selectSecureRandom } from './secure-random';

jest.mock('node:crypto', () => ({
  randomInt: jest.fn(),
}));

describe('selectSecureRandom', () => {
  const mockedRandomInt = jest.mocked(randomInt);

  beforeEach(() => mockedRandomInt.mockReset());

  it('uses crypto.randomInt with the complete collection length', () => {
    mockedRandomInt.mockReturnValue(2);

    expect(selectSecureRandom([10, 20, 30, 40])).toBe(30);
    expect(mockedRandomInt).toHaveBeenCalledWith(4);
  });

  it('rejects an empty collection', () => {
    expect(() => selectSecureRandom([])).toThrow(RangeError);
    expect(mockedRandomInt).not.toHaveBeenCalled();
  });
});
