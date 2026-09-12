import { validate } from 'class-validator';
import { ResendPlayerCardsDto } from './resend-player-cards.dto';

describe('ResendPlayerCardsDto', () => {
  it('accepts cards with a valid one-time recipient and request identifier', async () => {
    const dto = Object.assign(new ResendPlayerCardsDto(), {
      cardNumbers: [8],
      phone: '+573001234567',
      requestId: '8c24f723-1afd-4c5f-8705-d9ebd0600e21',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid cards, recipient and request identifier', async () => {
    const dto = Object.assign(new ResendPlayerCardsDto(), {
      cardNumbers: [0, 0],
      phone: '3001234567',
      requestId: 'repeated-click',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['cardNumbers', 'phone', 'requestId']),
    );
  });
});
