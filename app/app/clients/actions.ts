'use server';

import { cookies, headers } from 'next/headers';
import { getDb } from '../../../lib/db/client';
import { clients } from '../../../lib/db/schema';
import { getEnv } from '../../../lib/env';
import {
  SESSION_COOKIE_NAME,
  validateSession,
} from '../../../lib/auth/session';
import { isSameOriginRequest } from '../../../lib/auth/csrf';

export type ClientFieldErrors = Partial<Record<'name', string>>;

/** Typed result returned to the client form. */
export type ClientFormState = {
  createdClientId?: string;
  formError?: string;
  fieldErrors?: ClientFieldErrors;
  values?: { name?: string; email?: string; phone?: string; notes?: string };
};

const REQUEST_REJECTED_MESSAGE =
  'Your request could not be verified. Refresh the page and try again.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Log in again.';
const NO_BUSINESS_MESSAGE = 'Your account is not linked to a business yet.';
const NAME_REQUIRED_MESSAGE = 'Enter a client name.';

/** Reads a form field as a string; non-string values become empty. */
function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Trims an optional field and stores null when nothing is left. */
function optionalField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
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

export async function createClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  if (!(await isTrustedOrigin())) {
    return { formError: REQUEST_REJECTED_MESSAGE };
  }

  const values = {
    name: readField(formData, 'name'),
    email: readField(formData, 'email'),
    phone: readField(formData, 'phone'),
    notes: readField(formData, 'notes'),
  };

  const name = values.name.trim();
  if (name === '') {
    return { fieldErrors: { name: NAME_REQUIRED_MESSAGE }, values };
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) {
    return { formError: SESSION_EXPIRED_MESSAGE, values };
  }
  if (!session.business) {
    return { formError: NO_BUSINESS_MESSAGE, values };
  }

  if (
    name.length > 180 ||
    values.phone.length > 40 ||
    values.notes.length > 2500 ||
    (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
  )
    return {
      formError: 'Check the contact details and field lengths.',
      values,
    };
  const [created] = await getDb()
    .insert(clients)
    .values({
      businessId: session.business.businessId,
      name,
      email: optionalField(values.email),
      phone: optionalField(values.phone),
      notes: optionalField(values.notes),
    })
    .returning({ id: clients.id });

  return { createdClientId: created.id };
}
