import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

/** Hashes a plaintext password with bcrypt (cost 12). Length rules live in validation. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Constant-time comparison of a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
