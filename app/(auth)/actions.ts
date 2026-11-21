'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '../../lib/db/client';
import { businesses, businessMemberships, users } from '../../lib/db/schema';
import { getEnv } from '../../lib/env';
import { hashPassword, verifyPassword } from '../../lib/auth/password';
import {
  createSession,
  deleteSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../../lib/auth/session';
import { isSameOriginRequest } from '../../lib/auth/csrf';
import { checkAndRecordAttempt, resetAttempts, RATE_LIMIT_WINDOW_MS } from '../../lib/auth/rate-limit';
import { signUpSchema, loginSchema } from '../../lib/validation/auth';

type FieldName = 'displayName' | 'email' | 'password';

export type AuthFieldErrors = Partial<Record<FieldName, string>>;

/** Typed result returned to the forms. Passwords and tokens are never echoed back. */
export type AuthFormState = {
  formError?: string;
  fieldErrors?: AuthFieldErrors;
  values?: { displayName?: string; email?: string };
};

const LOGIN_FAILED_MESSAGE = 'Email or password is incorrect.';
const REQUEST_REJECTED_MESSAGE = 'Your request could not be verified. Refresh the page and try again.';
const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists.';
const UNIQUE_VIOLATION = '23505';

/** Reads a form field as a string; non-string values become empty. */
function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Same-origin check for server actions. Copies only the Origin/Referer headers
 * into a plain Headers object, because the request headers type from next/headers
 * is read-only and is not assignable to Headers.
 */
async function isTrustedOrigin(): Promise<boolean> {
  const incoming = await headers();
  const forwarded = new Headers();
  const origin = incoming.get('origin');
  const referer = incoming.get('referer');
  if (origin) forwarded.set('origin', origin);
  if (referer) forwarded.set('referer', referer);
  return isSameOriginRequest(forwarded, getEnv().APP_URL);
}

async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const direct = (error as { code?: unknown }).code;
  const cause = (error as { cause?: unknown }).cause;
  const causeCode =
    typeof cause === 'object' && cause !== null ? (cause as { code?: unknown }).code : undefined;
  return direct === UNIQUE_VIOLATION || causeCode === UNIQUE_VIOLATION;
}

/**
 * Lazily computes a bcrypt hash used when the email is unknown, so a failed
 * login for a missing user costs the same time as one for an existing user.
 */
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('duepilot-timing-equaliser-not-a-real-password');
  return dummyHashPromise;
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!(await isTrustedOrigin())) {
    return { formError: REQUEST_REJECTED_MESSAGE };
  }

  const rawDisplayName = readField(formData, 'displayName');
  const rawEmail = readField(formData, 'email');
  const password = readField(formData, 'password');
  const values = { displayName: rawDisplayName, email: rawEmail };

  const parsed = signUpSchema.safeParse({ displayName: rawDisplayName, email: rawEmail, password });
  if (!parsed.success) {
    const fieldErrors: AuthFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === 'displayName' || key === 'email' || key === 'password') && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors, values };
  }

  const { displayName, email } = parsed.data;
  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return { fieldErrors: { email: EMAIL_TAKEN_MESSAGE }, values };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, displayName, passwordHash })
        .returning({ id: users.id });

      const [business] = await tx
        .insert(businesses)
        .values({
          name: `${displayName}'s studio`,
          businessType: 'UNSPECIFIED',
          ownerUserId: user.id,
          isDemo: false,
        })
        .returning({ id: businesses.id });

      await tx.insert(businessMemberships).values({
        businessId: business.id,
        userId: user.id,
        role: 'OWNER',
      });

      return user.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { email: EMAIL_TAKEN_MESSAGE }, values };
    }
    throw error;
  }

  const session = await createSession(userId);
  await setSessionCookie(session.token);
  redirect('/app');
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!(await isTrustedOrigin())) {
    return { formError: REQUEST_REJECTED_MESSAGE };
  }

  const rawEmail = readField(formData, 'email');
  const password = readField(formData, 'password');
  const values = { email: rawEmail };

  const rateKey = `login:${rawEmail.trim().toLowerCase()}`;
  const attempt = checkAndRecordAttempt(rateKey);
  if (!attempt.allowed) {
    const minutes = Math.ceil(RATE_LIMIT_WINDOW_MS / 60000);
    return {
      formError: `Too many login attempts. Try again in up to ${minutes} minutes.`,
      values,
    };
  }

  const parsed = loginSchema.safeParse({ email: rawEmail, password });
  if (!parsed.success) {
    const fieldErrors: AuthFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'email' && !fieldErrors.email) fieldErrors.email = issue.message;
      if (key === 'password' && !fieldErrors.password) fieldErrors.password = issue.message;
    }
    return { fieldErrors, values };
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  // Always run one bcrypt comparison, even for unknown emails, to equalise timing.
  const hashToCheck = user?.passwordHash ?? (await getDummyHash());
  const passwordMatches = await verifyPassword(parsed.data.password, hashToCheck);

  if (!user || !passwordMatches) {
    return { formError: LOGIN_FAILED_MESSAGE, values };
  }

  resetAttempts(rateKey);
  const session = await createSession(user.id);
  await setSessionCookie(session.token);
  redirect('/app');
}

export async function logoutAction(): Promise<void> {
  if (!(await isTrustedOrigin())) {
    return;
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token);
  }
  jar.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}
