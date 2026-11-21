'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../../lib/db/client';
import { and, eq } from 'drizzle-orm';
import { expenses, projects, activities } from '../../../lib/db/schema';
import { getEnv } from '../../../lib/env';
import {
  SESSION_COOKIE_NAME,
  validateSession,
} from '../../../lib/auth/session';
import { isSameOriginRequest } from '../../../lib/auth/csrf';
import { parseRupeesToPaise } from '../../../lib/money';
import { isValidIsoDate, mapRecurrenceRule } from '../../../lib/records/rules';

export type ExpenseFieldErrors = Partial<
  Record<
    'description' | 'category' | 'amount' | 'dueDate' | 'recurrenceRule',
    string
  >
>;

/** Typed result returned to the client form. */
export type ExpenseFormState = {
  notice?: string;
  formError?: string;
  fieldErrors?: ExpenseFieldErrors;
  values?: {
    description?: string;
    category?: string;
    amount?: string;
    dueDate?: string;
    recurrenceRule?: string;
  };
};

const REQUEST_REJECTED_MESSAGE =
  'Your request could not be verified. Refresh the page and try again.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Log in again.';
const NO_BUSINESS_MESSAGE = 'Your account is not linked to a business yet.';
const DESCRIPTION_REQUIRED_MESSAGE = 'Enter a description.';
const CATEGORY_REQUIRED_MESSAGE = 'Enter a category.';
const AMOUNT_INVALID_MESSAGE = 'Enter an amount greater than zero.';
const DUE_DATE_INVALID_MESSAGE = 'Enter a valid due date.';
const RECURRENCE_INVALID_MESSAGE = 'Choose one-off, monthly or weekly.';

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

export async function createExpense(
  _previous: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  if (!(await isTrustedOrigin())) {
    return { formError: REQUEST_REJECTED_MESSAGE };
  }

  const values = {
    description: readField(formData, 'description'),
    category: readField(formData, 'category'),
    amount: readField(formData, 'amount'),
    dueDate: readField(formData, 'dueDate'),
    recurrenceRule: readField(formData, 'recurrenceRule'),
  };

  const description = values.description.trim();
  const category = values.category.trim();
  const dueDate = values.dueDate.trim();

  const fieldErrors: ExpenseFieldErrors = {};
  if (description === '')
    fieldErrors.description = DESCRIPTION_REQUIRED_MESSAGE;
  if (category === '') fieldErrors.category = CATEGORY_REQUIRED_MESSAGE;

  let amountPaise = 0;
  try {
    amountPaise = parseRupeesToPaise(values.amount);
    if (amountPaise <= 0) fieldErrors.amount = AMOUNT_INVALID_MESSAGE;
  } catch {
    fieldErrors.amount = AMOUNT_INVALID_MESSAGE;
  }

  if (!isValidIsoDate(dueDate)) fieldErrors.dueDate = DUE_DATE_INVALID_MESSAGE;

  const recurrenceChoice = values.recurrenceRule;
  let recurrenceRule: ReturnType<typeof mapRecurrenceRule> = null;
  if (
    recurrenceChoice === '' ||
    recurrenceChoice === 'MONTHLY' ||
    recurrenceChoice === 'WEEKLY'
  ) {
    recurrenceRule = mapRecurrenceRule(recurrenceChoice);
  } else {
    fieldErrors.recurrenceRule = RECURRENCE_INVALID_MESSAGE;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values };
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) {
    return { formError: SESSION_EXPIRED_MESSAGE, values };
  }
  if (!session.business) {
    return { formError: NO_BUSINESS_MESSAGE, values };
  }

  const b = session.business.businessId,
    projectId = readField(formData, 'projectId'),
    notes = readField(formData, 'notes').trim();
  if (description.length > 200 || category.length > 100 || notes.length > 2000)
    return { formError: 'Bill fields exceed their size limit.', values };
  if (
    projectId &&
    (!/^[a-f0-9-]{36}$/i.test(projectId) ||
      !(
        await getDb()
          .select()
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.businessId, b)))
      ).length)
  )
    return { formError: 'Choose a project in this studio.', values };
  await getDb().transaction(async (tx) => {
    const [e] = await tx
      .insert(expenses)
      .values({
        businessId: b,
        projectId: projectId || null,
        notes,
        description,
        category,
        amountPaise,
        dueDate,
        status: 'UNPAID',
        recurrenceRule,
      })
      .returning();
    await tx
      .insert(activities)
      .values({
        businessId: b,
        actorUserId: session.user.id,
        eventType: 'Bill scheduled',
        entityType: 'expense',
        entityId: e.id,
        afterJson: { amount: amountPaise, description },
      });
  });

  revalidatePath('/app/expenses');
  return { notice: 'Bill saved.' };
}
