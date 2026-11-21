import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/auth/password';

describe('password hashing', () => {
  it('verifies the original password after hashing (round trip)', async () => {
    const plain = 'correct horse battery staple';
    const hash = await hashPassword(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
  }, 20_000);

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password entirely', hash)).toBe(false);
  }, 20_000);

  it('never stores the plaintext as the hash', async () => {
    const plain = 'correct horse battery staple';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash).not.toContain(plain);
  }, 20_000);
});
