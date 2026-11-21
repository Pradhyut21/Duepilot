'use server';

import { cookies, headers } from 'next/headers';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import {
  clients,
  invoiceItems,
  invoices,
  businesses,
  projects,
  activities,
  paymentMilestones,
} from '../../../lib/db/schema';
import { z } from 'zod';
import { todayInTimezone } from '@/lib/records/invoice-dates';
import { getEnv } from '../../../lib/env';
import {
  SESSION_COOKIE_NAME,
  validateSession,
} from '../../../lib/auth/session';
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

export type InvoiceFieldErrors = Partial<
  Record<'clientId' | 'dueDate', string>
>;

/** Typed result returned to the invoice form. */
export type InvoiceFormState = {
  savedInvoiceId?: string;
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

const REQUEST_REJECTED_MESSAGE =
  'Your request could not be verified. Refresh the page and try again.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Log in again.';
const NO_BUSINESS_MESSAGE = 'Your account is not linked to a business yet.';
const CLIENT_REQUIRED_MESSAGE = 'Choose a client.';
const CLIENT_NOT_FOUND_MESSAGE = 'That client was not found for this business.';
const DUE_DATE_MESSAGE = 'Enter a valid due date.';
const ITEM_REQUIRED_MESSAGE = 'Add at least one line item.';
const ITEM_DESCRIPTION_MESSAGE = 'Each line item needs a description.';
const TOO_LARGE_MESSAGE = 'This invoice is too large to save.';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const quantityThousandths = parseQuantityThousandths(
      readField(formData, `items.${i}.quantity`),
    );
    const unitPricePaise = parseRupeesToPaise(
      readField(formData, `items.${i}.unitPrice`),
    );
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
  if (!UUID_PATTERN.test(clientId))
    fieldErrors.clientId = CLIENT_REQUIRED_MESSAGE;
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
    items.map((item) => ({
      lineTotalPaise: item.lineTotalPaise,
      taxRateBp: item.taxRateBp,
    })),
  );
  if (totals.totalPaise > MAX_PAISE) {
    return { formError: TOO_LARGE_MESSAGE, values };
  }

  const asOf = session.business.isDemo
    ? '2026-11-21'
    : todayInTimezone('Asia/Kolkata');
  const issueDate = readField(formData, 'issue') || asOf,
    draftId = readField(formData, 'id'),
    custom = readField(formData, 'number').trim(),
    projectName = readField(formData, 'project').trim();
  if (
    !isValidIsoDate(issueDate) ||
    issueDate > asOf ||
    dueDate < issueDate ||
    !totals.totalPaise
  )
    return {
      formError: 'Check the issue date, due date and positive invoice total.',
      values,
    };
  if (
    custom.length > 80 ||
    projectName.length > 120 ||
    items.length > 50 ||
    items.some((i) => i.description.length > 500)
  )
    return { formError: 'Invoice fields exceed the supported size.', values };
  const installment = z.object({
    name: z.string().trim().min(1).max(120),
    amount: z
      .string()
      .transform(parseRupeesToPaise)
      .refine((n) => n > 0),
    due: z.string().refine((d) => isValidIsoDate(d) && d >= issueDate),
    expected: z
      .string()
      .refine((d) => !d || (isValidIsoDate(d) && d >= issueDate)),
  });
  let plan: z.infer<typeof installment>[];
  try {
    plan = z
      .array(installment)
      .max(30)
      .parse(JSON.parse(readField(formData, 'milestones') || '[]'));
  } catch {
    return {
      formError: 'Check the milestone names, amounts and dates.',
      values,
    };
  }
  if (
    plan.length &&
    plan.reduce((n, p) => n + p.amount, 0) !== totals.totalPaise
  )
    return {
      formError: 'Milestone amounts must add up to the invoice total.',
      values,
    };
  let resultId = '';
  try {
    await db.transaction(async (tx) => {
      await tx
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .for('update');
      let projectId: string | null = null;
      if (projectName) {
        const [prior] = await tx
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.businessId, businessId),
              eq(projects.clientId, clientId),
              eq(projects.name, projectName),
            ),
          );
        projectId =
          prior?.id ??
          (
            await tx
              .insert(projects)
              .values({ businessId, clientId, name: projectName })
              .returning()
          )[0].id;
      }
      const common = {
        clientId,
        issueDate,
        dueDate,
        projectId,
        ...totals,
        updatedAt: new Date(),
      };
      if (draftId) {
        const [old] = await tx
          .select()
          .from(invoices)
          .where(
            and(eq(invoices.businessId, businessId), eq(invoices.id, draftId)),
          )
          .for('update');
        if (!old || old.status !== 'DRAFT') throw Error('LOCKED');
        await tx
          .update(invoices)
          .set({ ...common, invoiceNumber: custom || old.invoiceNumber })
          .where(
            and(eq(invoices.businessId, businessId), eq(invoices.id, draftId)),
          );
        resultId = draftId;
        await tx
          .delete(invoiceItems)
          .where(eq(invoiceItems.invoiceId, draftId));
        await tx
          .delete(paymentMilestones)
          .where(eq(paymentMilestones.invoiceId, draftId));
      } else {
        const sequence = await tx.execute(sql`
          INSERT INTO invoice_counters(business_id,last_number)
          SELECT ${businessId}, coalesce(max(substring(invoice_number from '^INV-([0-9]{1,8})$')::integer),0)+1
          FROM invoices WHERE business_id=${businessId}
          ON CONFLICT(business_id) DO UPDATE SET
            last_number=greatest(invoice_counters.last_number+1,excluded.last_number),updated_at=now()
          RETURNING last_number
        `);
        resultId = (
          await tx
            .insert(invoices)
            .values({
              ...common,
              businessId,
              invoiceNumber:
                custom ||
                formatInvoiceNumber(Number(sequence.rows[0].last_number)),
              status: 'DRAFT',
            })
            .returning()
        )[0].id;
      }
      await tx
        .insert(invoiceItems)
        .values(
          items.map((i) => ({
            invoiceId: resultId,
            description: i.description,
            quantity: quantityToNumeric(i.quantityThousandths),
            unitPricePaise: i.unitPricePaise,
            taxRateBp: i.taxRateBp,
            lineTotalPaise: i.lineTotalPaise,
          })),
        );
      if (plan.length)
        await tx
          .insert(paymentMilestones)
          .values(
            plan.map((p) => ({
              invoiceId: resultId,
              name: p.name,
              expectedAmountPaise: p.amount,
              dueDate: p.due,
              expectedPaymentDate: p.expected || null,
            })),
          );
      await tx
        .insert(activities)
        .values({
          businessId,
          actorUserId: session.user.id,
          eventType: draftId ? 'Draft revised' : 'Draft created',
          entityType: 'invoice',
          entityId: resultId,
          afterJson: { total: totals.totalPaise },
        });
    });
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    return {
      formError:
        code === '23505'
          ? 'This invoice number is already in use.'
          : 'Could not save the draft. Check that it is still editable.',
      values,
    };
  }

  return { savedInvoiceId: resultId };
}
