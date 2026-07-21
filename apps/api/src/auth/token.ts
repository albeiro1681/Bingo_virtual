import { createHash, randomBytes } from 'node:crypto';

export function generateAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
