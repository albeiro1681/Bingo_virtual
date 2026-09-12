import { validate } from 'class-validator';
import { SendPlayerAccessLinkDto } from './send-player-access-link.dto';

describe('SendPlayerAccessLinkDto', () => {
  it('accepts a valid one-time recipient and request identifier', async () => {
    const dto = Object.assign(new SendPlayerAccessLinkDto(), {
      phone: '+573001234567',
      requestId: '8c24f723-1afd-4c5f-8705-d9ebd0600e21',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an invalid recipient and request identifier', async () => {
    const dto = Object.assign(new SendPlayerAccessLinkDto(), {
      phone: '3001234567',
      requestId: 'repeated-click',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['phone', 'requestId']),
    );
  });
});
