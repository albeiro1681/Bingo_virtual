import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGameDto } from './create-game.dto';

describe('CreateGameDto prizeAmount', () => {
  const errorsFor = (prizeAmount?: unknown) =>
    validate(
      plainToInstance(CreateGameDto, {
        name: 'Sorteo de prueba',
        ...(prizeAmount !== undefined ? { prizeAmount } : {}),
      }),
    );

  it('accepts a positive integer amount', async () => {
    await expect(errorsFor(1500000)).resolves.toHaveLength(0);
  });

  it.each([undefined, 0, -1, '1500000', '1e6', 'abc'])(
    'rejects invalid prize amount %p',
    async (value) => {
      const errors = await errorsFor(value);
      expect(errors.some((error) => error.property === 'prizeAmount')).toBe(
        true,
      );
    },
  );
});
