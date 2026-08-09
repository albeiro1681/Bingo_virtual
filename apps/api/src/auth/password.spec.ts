import { hashPassword, verifyPassword } from './password';

describe('admin passwords', () => {
  it('hashes with a random salt and verifies only the correct password', async () => {
    const first = await hashPassword('Una-clave-segura-123');
    const second = await hashPassword('Una-clave-segura-123');
    expect(first).not.toBe(second);
    await expect(verifyPassword('Una-clave-segura-123', first)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('incorrecta-123', first)).resolves.toBe(false);
  });
});
