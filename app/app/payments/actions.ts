'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, like } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { clients, invoices, payments } from '../../../lib/db/schema';
import { getEnv } from '../../../lib/env';
import { SESSION_COOKIE_NAME, validateSession } from '../../../lib/auth/session';
import { isSameOriginRequest } from '../../../lib/auth/csrf';
import { scopeByBusiness } from '../../../lib/auth/tenant';
import { parseRupeesToPaise } from '../../../lib/money';
import { allocatePayment } from '../../../lib/finance';
import { isValidIsoDate } from '../../../lib/records/rules';
import {
  PaymentExceedsOutstandingError,
  assertPaymentWithinOutstanding,
  computeOutstandingPaise,
  isPayableStatus,
  sumPayableOutstanding,
} from '../../../lib/payments/rules';

export type PaymentFieldErrors = Partial<
  Record<'clientId' | 'amount' | 'receivedDate' | 'method' | 'reference', string>
>;

/** Typed result returned to the payment form. */
export type PaymentFormState = {
  formError?: string;
  /** Informational result, e.g. a submission that was already recorded. */
  notice?: string;
  /** Exact payable outstanding in paise, set when an amount is rejected as too large. */
  outstandingPaise?: number;
  fieldErrors?: PaymentFieldErrors;
  values?: {
    clientId?: string;
    amount?: string;
    receivedDate?: string;
    method?: string;
    reference?: string;
  };
};

const REQUEST_REJECTED_MESSAGE = 'Your request could not be verified. Refresh the page and try again.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Log in again.';
const NO_BUSINESS_MESSAGE = 'Your account is not linked to a business yet.';
const CLIENT_REQUIRED_MESSAGE = 'Choose a client.';
const CLIENT_NOT_FOUND_MESSAGE = 'That client was not found for this business.';
const AMOUNT_REQUIRED_MESSAGE = 'Enter an amount in rupees.';
const AMOUNT_POSITIVE_MESSAGE = 'Enter an amount greater than zero.';
const DATE_MESSAGE = 'Enter a valid received date.';
const METHOD_REQUIRED_MESSAGE = 'Enter how the payment was received.';
const METHOD_MAX_LENGTH = 50;
const REFERENCE_MAX_LENGTH = 200;
const NO_OPEN_INVOICES_MESSAGE = 'This client has no invoices awaiting payment. Issue an invoice first.';
const ALREADY_RECORDED_MESSAGE = 'This payment was already recorded. Nothing was added.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION_CODE = '23505';

/** Reads a form field as a string; non-string values become empty. */
function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** True when the error (or its wrapped cause) is a Postgres unique violation. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const direct = (error as { code?: unknown }).code;
  if (direct === UNIQUE_VIOLATION_CODE) return true;
  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    return (cause as { code?: unknown }).code === UNIQUE_VIOLATION_CODE;
  }
  return false;
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

type TransactionOutcome =
  | { status: 'recorded' }
  | { status: 'already_recorded' }
  | { status: 'no_open_invoices' }
  | { status: 'exceeds'; outstandingPaise: number; message: string };

export async function recordPayment(
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  if (!(await isTrustedOrigin())) {
    return { formError: REQUEST_REJECTED_MESSAGE };
  }

  const clientId = readField(formData, 'clientId').trim();
  const amount = readField(formData, 'amount').trim();
  const receivedDate = readField(formData, 'receivedDate').trim();
  const method = readField(formData, 'method').trim();
  const reference = readField(formData, 'reference').trim();
  const submissionKey = readField(formData, 'submissionKey').trim();
  const values = { clientId, amount, receivedDate, method, reference };

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) {
    return { formError: SESSION_EXPIRED_MESSAGE, values };
  }
  if (!session.business) {
    return { formError: NO_BUSINESS_MESSAGE, values };
  }
  const businessId = session.business.businessId;

  if (!UUID_PATTERN.test(submissionKey)) {
    return { formError: REQUEST_REJECTED_MESSAGE, values };
  }

  const fieldErrors: PaymentFieldErrors = {};
  if (!UUID_PATTERN.test(clientId)) fieldErrors.clientId = CLIENT_REQUIRED_MESSAGE;

  let amountPaise = 0;
  if (amount === '') {
    fieldErrors.amount = AMOUNT_REQUIRED_MESSAGE;
  } else {
    try {
      amountPaise = parseRupeesToPaise(amount);
      if (amountPaise <= 0) fieldErrors.amount = AMOUNT_POSITIVE_MESSAGE;
    } catch (error) {
      fieldErrors.amount = error instanceof Error ? error.message : AMOUNT_REQUIRED_MESSAGE;
    }
  }

  if (!isValidIsoDate(receivedDate)) fieldErrors.receivedDate = DATE_MESSAGE;
  if (method === '') {
    fieldErrors.method = METHOD_REQUIRED_MESSAGE;
  } else if (method.length > METHOD_MAX_LENGTH) {
    fieldErrors.method = `Method can be at most ${METHOD_MAX_LENGTH} characters.`;
  }
  if (reference.length > REFERENCE_MAX_LENGTH) {
    fieldErrors.reference = `Reference can be at most ${REFERENCE_MAX_LENGTH} characters.`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values };
  }

  const db = getDb();

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        scopeByBusiness(clients.businessId, businessId),
        eq(clients.id, clientId),
        isNull(clients.archivedAt),
      ),
    )
    .limit(1);
  if (!client) {
    return { fieldErrors: { clientId: CLIENT_NOT_FOUND_MESSAGE }, values };
  }

  let outcome: TransactionOutcome;
  try {
    outcome = await db.transaction(async (tx): Promise<TransactionOutcome> => {
      // Lock the client's invoice rows so a concurrent payment waits and sees
      // the updated outstanding balances.
      const invoiceRows = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
          totalPaise: invoices.totalPaise,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .where(
          and(scopeByBusiness(invoices.businessId, businessId), eq(invoices.clientId, client.id)),
        )
        .for('update');

      // Double-submit guard: rows from an earlier submission of this form render
      // carry keys starting with this submission key. Checked after the lock so a
      // concurrent duplicate waits for the first one to commit.
      const priorRows = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            scopeByBusiness(payments.businessId, businessId),
            like(payments.idempotencyKey, `${submissionKey}:%`),
          ),
        )
        .limit(1);
      if (priorRows.length > 0) {
        return { status: 'already_recorded' };
      }

      const invoiceIds = invoiceRows.map((row) => row.id);
      const paymentRows =
        invoiceIds.length === 0
          ? []
          : await tx
              .select({ invoiceId: payments.invoiceId, amountPaise: payments.amountPaise })
              .from(payments)
              .where(
                and(
                  scopeByBusiness(payments.businessId, businessId),
                  inArray(payments.invoiceId, invoiceIds),
                  isNull(payments.reversedAt),
                ),
              );

      const paidByInvoice = new Map<string, number>();
      for (const row of paymentRows) {
        paidByInvoice.set(row.invoiceId, (paidByInvoice.get(row.invoiceId) ?? 0) + row.amountPaise);
      }

      const withPaid = invoiceRows.map((row) => ({
        id: row.id,
        status: row.status,
        totalPaise: row.totalPaise,
        paidPaise: paidByInvoice.get(row.id) ?? 0,
        dueDate: row.dueDate,
      }));

      const { payableOutstandingPaise } = sumPayableOutstanding(withPaid);
      if (payableOutstandingPaise === 0) {
        return { status: 'no_open_invoices' };
      }

      try {
        assertPaymentWithinOutstanding(amountPaise, payableOutstandingPaise);
      } catch (error) {
        if (error instanceof PaymentExceedsOutstandingError) {
          return {
            status: 'exceeds',
            outstandingPaise: error.outstandingPaise,
            message: error.message,
          };
        }
        throw error;
      }

      const open = withPaid
        .filter((row) => isPayableStatus(row.status))
        .map((row) => ({
          id: row.id,
          outstandingPaise: computeOutstandingPaise(row.totalPaise, row.paidPaise),
          dueDate: row.dueDate,
        }))
        .filter((row) => row.outstandingPaise > 0);

      const { allocations, unallocatedPaise } = allocatePayment(amountPaise, open);
      if (unallocatedPaise > 0) {
        // Cannot happen after the check above; throwing rolls back the transaction.
        throw new Error('Payment allocation did not cover the full amount.');
      }

      // All allocation rows are inserted in this one statement, so either every
      // row is written or none is. Keys are deterministic per form render and invoice.
      await tx.insert(payments).values(
        allocations.map((allocation) => ({
          businessId,
          invoiceId: allocation.invoiceId,
          amountPaise: allocation.allocatedPaise,
          receivedDate,
          method,
          reference: reference === '' ? null : reference,
          idempotencyKey: `${submissionKey}:${allocation.invoiceId}`,
        })),
      );

      for (const allocation of allocations) {
        const invoiceOpen = open.find((row) => row.id === allocation.invoiceId);
        const remaining = (invoiceOpen?.outstandingPaise ?? 0) - allocation.allocatedPaise;
        await tx
          .update(invoices)
          .set({
            status: remaining === 0 ? 'PAID' : 'PARTIALLY_PAID',
            updatedAt: new Date(),
          })
          .where(
            and(
              scopeByBusiness(invoices.businessId, businessId),
              eq(invoices.id, allocation.invoiceId),
            ),
          );
      }

      return { status: 'recorded' };
    });
  } catch (error) {
    // A unique violation on (businessId, idempotencyKey) means this submission
    // was already written. The transaction rolled back, so nothing is duplicated.
    if (isUniqueViolation(error)) {
      return { notice: ALREADY_RECORDED_MESSAGE, values };
    }
    throw error;
  }

  if (outcome.status === 'already_recorded') {
    return { notice: ALREADY_RECORDED_MESSAGE, values };
  }
  if (outcome.status === 'no_open_invoices') {
    return { formError: NO_OPEN_INVOICES_MESSAGE, values };
  }
  if (outcome.status === 'exceeds') {
    return { formError: outcome.message, outstandingPaise: outcome.outstandingPaise, values };
  }

  revalidatePath('/app/payments');
  revalidatePath('/app/invoices');
  redirect('/app/payments');
}
