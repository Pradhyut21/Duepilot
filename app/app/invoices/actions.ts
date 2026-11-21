'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, count, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { clients, invoiceItems, invoices } from '../../../lib/db/schema';
import { getEnv } from '../../../lib/env';
import { SESSION_COOKIE_NAME, validateSession } from '../../../lib/auth/session';
import { isSameOriginRequest } from '../../../lib/auth/csrf';
import { scopeByBusiness } from '../../../lib/auth/tenant';
import { MAX_PAISE, parseRupeesToPaise } from '../../../lib/money';
import { computeInvoiceTotals } from '../../../lib/finance';
import {
  formatInvoiceNumber,
  isValidIsoDate,
  lineTotalPaise,
  parseQuantityThousandths,
  parseTaxRateBp,
} from '../../../lib/records/rules';

export type InvoiceFieldErrors = Partial<Record<'clientId' | 'dueDate', string>>;

/** Typed result returned to the invoice form. */
export type InvoiceFormState = {
  formError?: string;
  fieldErrors?: InvoiceFieldErrors;
  values?: {
    clientId?: string;
    dueDate?: string;
    description?: string;
    quantity?: string;
    unitPrice?: string;
    taxRate?: string;
  };
};

type ParsedItem = {
  description: string;
  quantityThousandths: number;
  unitPricePaise: number;
  taxRateBp: number | null;
  lineTotalPaise: number;
};

const REQUEST_REJECTED_MESSAGE = 'Your request could not be verified. Refresh the page and try again.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Log in again.';
const NO_BUSINESS_MESSAGE = 'Your account is not linked to a business yet.';
const CLIENT_REQUIRED_MESSAGE = 'Choose a client.';
const CLIENT_NOT_FOUND_MESSAGE = 'That client was not found for this business.';
const DUE_DATE_MESSAGE = 'Enter a valid due date.';
const ITEM_REQUIRED_MESSAGE = 'Add at least one line item.';
const ITEM_DESCRIPTION_MESSAGE = 'Each line item needs a description.';
const TOO_LARGE_MESSAGE = 'This invoice is too large to save.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Formats integer thousandths as a decimal string for the numeric column. */
function quantityToNumeric(thousandths: number): string {
  return `${Math.floor(thousandths / 1000)}.${String(thousandths % 1000).padStart(3, '0')}`;
}

/**
 * Parses line items named items.0.*, items.1.*, ... until the first index with
 * no description field. Throws with a user-facing message on bad input.
 */
function parseItems(formData: FormData): ParsedItem[] {
  const items: ParsedItem[] = [];
  for (let i = 0; formData.has(`items.${i}.description`); i++) {
    const description = readField(formData, `items.${i}.description`).trim();
    if (description === '') throw new Error(ITEM_DESCRIPTION_MESSAGE);

    const quantityThousandths = parseQuantityThousandths(readField(formData, `items.${i}.quantity`));
    const unitPricePaise = parseRupeesToPaise(readField(formData, `items.${i}.unitPrice`));
    const taxInput = readField(formData, `items.${i}.taxRate`).trim();
    const taxRateBp = taxInput === '' ? null : parseTaxRateBp(taxInput);

    const linePaise = lineTotalPaise(quantityThousandths, unitPricePaise);
    if (linePaise > MAX_PAISE) throw new Error(TOO_LARGE_MESSAGE);

    items.push({
      description,
      quantityThousandths,
      unitPricePaise,
      taxRateBp,
      lineTotalPaise: linePaise,
    });
  }
  if (items.length === 0) throw new Error(ITEM_REQUIRED_MESSAGE);
  return items;
}

export async function createInvoice(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  if (!(await isTrustedOrigin())) {
    return { formError: REQUEST_REJECTED_MESSAGE };
  }

  const clientId = readField(formData, 'clientId').trim();
  const dueDate = readField(formData, 'dueDate').trim();
  const values = {
    clientId,
    dueDate,
    description: readField(formData, 'items.0.description'),
    quantity: readField(formData, 'items.0.quantity'),
    unitPrice: readField(formData, 'items.0.unitPrice'),
    taxRate: readField(formData, 'items.0.taxRate'),
  };

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) {
    return { formError: SESSION_EXPIRED_MESSAGE, values };
  }
  if (!session.business) {
    return { formError: NO_BUSINESS_MESSAGE, values };
  }
  const businessId = session.business.businessId;

  const fieldErrors: InvoiceFieldErrors = {};
  if (!UUID_PATTERN.test(clientId)) fieldErrors.clientId = CLIENT_REQUIRED_MESSAGE;
  if (!isValidIsoDate(dueDate)) fieldErrors.dueDate = DUE_DATE_MESSAGE;

  let items: ParsedItem[] = [];
  let itemError: string | undefined;
  try {
    items = parseItems(formData);
  } catch (error) {
    itemError = error instanceof Error ? error.message : ITEM_REQUIRED_MESSAGE;
  }
  if (itemError !== undefined || Object.keys(fieldErrors).length > 0) {
    return { formError: itemError, fieldErrors, values };
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

  const totals = computeInvoiceTotals(
    items.map((item) => ({ lineTotalPaise: item.lineTotalPaise, taxRateBp: item.taxRateBp })),
  );
  if (totals.totalPaise > MAX_PAISE) {
    return { formError: TOO_LARGE_MESSAGE, values };
  }

  // Business-local issue date (Asia/Kolkata), formatted as YYYY-MM-DD.
  const issueDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  await db.transaction(async (tx) => {
    const countRows = await tx
      .select({ value: count() })
      .from(invoices)
      .where(scopeByBusiness(invoices.businessId, businessId));
    const existing = countRows[0]?.value ?? 0;

    const [invoice] = await tx
      .insert(invoices)
      .values({
        businessId,
        clientId: client.id,
        invoiceNumber: formatInvoiceNumber(existing + 1),
        issueDate,
        dueDate,
        status: 'DRAFT',
        subtotalPaise: totals.subtotalPaise,
        taxAmountPaise: totals.taxAmountPaise,
        totalPaise: totals.totalPaise,
        currency: 'INR',
      })
      .returning({ id: invoices.id });
    if (!invoice) {
      throw new Error('Invoice insert returned no row');
    }

    await tx.insert(invoiceItems).values(
      items.map((item) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: quantityToNumeric(item.quantityThousandths),
        unitPricePaise: item.unitPricePaise,
        taxRateBp: item.taxRateBp,
        lineTotalPaise: item.lineTotalPaise,
      })),
    );
  });

  revalidatePath('/app/invoices');
  redirect('/app/invoices');
}
