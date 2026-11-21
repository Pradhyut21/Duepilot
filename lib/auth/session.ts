import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { sessions, users } from '../db/schema';
import { requireBusinessContext, type BusinessContext } from './tenant';

export const SESSION_COOKIE_NAME = 'duepilot_session';
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface AuthenticatedSession {
  user: { id: string; email: string; displayName: string };
  business: BusinessContext | null;
}

/** 32 cryptographically random bytes, base64url encoded. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only the SHA-256 hash of a token is stored; the raw token lives in the cookie. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(sessions)
    .values({ userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}

/** Returns the user and their first business membership, or null if missing/expired. */
export async function validateSession(token: string): Promise<AuthenticatedSession | null> {
  if (!token) {
    return null;
  }

  const rows = await getDb()
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashSessionToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row || isSessionExpired(row.expiresAt)) {
    return null;
  }

  const business = await requireBusinessContext(row.userId);
  return {
    user: { id: row.userId, email: row.email, displayName: row.displayName },
    business,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}

/** Options for the session cookie; pass to the framework's cookie setter. */
export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
