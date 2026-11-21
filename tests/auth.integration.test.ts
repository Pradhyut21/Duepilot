import { describe, it, expect, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db/client';
import { businesses, businessMemberships, users } from '../lib/db/schema';
import { hashPassword } from '../lib/auth/password';
import { createSession, deleteSession, validateSession } from '../lib/auth/session';

const hasDatabase = Boolean(process.env.DATABASE_URL);
if (!hasDatabase) {
  console.log('Skipping DB integration tests: DATABASE_URL not set');
}
const describeWithDb = hasDatabase ? describe : describe.skip;

describeWithDb('auth persistence (DB integration)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `integration-${runId}@example.test`;

  let userId: string | undefined;
  let businessId: string | undefined;

  afterAll(async () => {
    const db = getDb();
    // Business first: owner_user_id references users without cascade.
    if (businessId) {
      await db.delete(businesses).where(eq(businesses.id, businessId));
    }
    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it('creates a session, validates it, deletes it, and then rejects it', async () => {
    const db = getDb();

    const [user] = await db
      .insert(users)
      .values({
        email,
        displayName: 'Integration Test',
        passwordHash: await hashPassword('integration-password-1'),
      })
      .returning({ id: users.id });
    userId = user.id;

    const [business] = await db
      .insert(businesses)
      .values({
        name: `Integration Studio ${runId}`,
        businessType: 'UNSPECIFIED',
        ownerUserId: user.id,
        isDemo: false,
      })
      .returning({ id: businesses.id });
    businessId = business.id;

    await db.insert(businessMemberships).values({
      businessId: business.id,
      userId: user.id,
      role: 'OWNER',
    });

    const { token } = await createSession(user.id);

    const validated = await validateSession(token);
    expect(validated).not.toBeNull();
    expect(validated?.user.email).toBe(email);
    expect(validated?.business?.businessId).toBe(business.id);

    await deleteSession(token);
    expect(await validateSession(token)).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    expect(await validateSession('not-a-real-token-value-for-tests')).toBeNull();
  });
});
