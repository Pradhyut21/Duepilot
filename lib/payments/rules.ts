/**
 * Pure payment rules for DuePilot. No database or framework imports.
 * All money is integer paise (INR). Dates are YYYY-MM-DD strings.
 */

export const PAYABLE_INVOICE_STATUSES = ['ISSUED', 'PARTIALLY_PAID'] as const;

export type DisplayStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export type PayableInvoiceInput = {
  id: string;
  status: string;
  totalPaise: number;
  paidPaise: number;
};

export type PayableSummary = {
  payableOutstandingPaise: number;
  payableInvoiceIds: string[];
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const KNOWN_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID'] as const;

/** Thrown when a payment is larger than the payable outstanding balance. */
export class PaymentExceedsOutstandingError extends Error {
  readonly outstandingPaise: number;

  constructor(outstandingPaise: number) {
    const amount = formatPaiseAsRupees(outstandingPaise);
    super(`Only ${amount} can be applied. Enter up to ${amount}.`);
    this.name = 'PaymentExceedsOutstandingError';
    this.outstandingPaise = outstandingPaise;
  }
}

/** Formats integer paise as "₹" plus two decimals, e.g. 123450 -> "₹1234.50". */
export function formatPaiseAsRupees(paise: number): string {
  assertSafeInteger(paise, 'paise');
  return `₹${(paise / 100).toFixed(2)}`;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer (got ${value})`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must not be negative (got ${value})`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be greater than zero (got ${value})`);
  }
}

function isRealIsoDate(input: string): boolean {
  const match = DATE_PATTERN.exec(input);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/** True only for ISSUED and PARTIALLY_PAID. */
export function isPayableStatus(status: string): boolean {
  return (PAYABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

/**
 * Outstanding balance for one invoice: total minus the sum of non-reversed
 * payments. Throws if paid exceeds total, since that state should never occur.
 */
export function computeOutstandingPaise(totalPaise: number, paidPaise: number): number {
  assertNonNegativeSafeInteger(totalPaise, 'totalPaise');
  assertNonNegativeSafeInteger(paidPaise, 'paidPaise');
  if (paidPaise > totalPaise) {
    throw new Error(`Paid amount ${paidPaise} exceeds invoice total ${totalPaise}`);
  }
  return totalPaise - paidPaise;
}

/**
 * Sums outstanding balances across payable invoices only (ISSUED or
 * PARTIALLY_PAID with outstanding > 0). Drafts and settled invoices are ignored.
 */
export function sumPayableOutstanding(invoices: PayableInvoiceInput[]): PayableSummary {
  let payableOutstandingPaise = 0;
  const payableInvoiceIds: string[] = [];

  for (const invoice of invoices) {
    const outstanding = computeOutstandingPaise(invoice.totalPaise, invoice.paidPaise);
    if (!isPayableStatus(invoice.status) || outstanding <= 0) continue;
    payableOutstandingPaise += outstanding;
    assertSafeInteger(payableOutstandingPaise, 'payableOutstandingPaise');
    payableInvoiceIds.push(invoice.id);
  }

  return { payableOutstandingPaise, payableInvoiceIds };
}

/**
 * Rejects a payment larger than the payable outstanding balance. A payment
 * equal to the outstanding balance is accepted.
 *
 * @throws PaymentExceedsOutstandingError when amountPaise > payableOutstandingPaise.
 */
export function assertPaymentWithinOutstanding(
  amountPaise: number,
  payableOutstandingPaise: number,
): void {
  assertPositiveSafeInteger(amountPaise, 'amountPaise');
  assertNonNegativeSafeInteger(payableOutstandingPaise, 'payableOutstandingPaise');
  if (amountPaise > payableOutstandingPaise) {
    throw new PaymentExceedsOutstandingError(payableOutstandingPaise);
  }
}

/**
 * Display status for an invoice. OVERDUE applies to ISSUED or PARTIALLY_PAID
 * invoices with outstanding > 0 whose dueDate is strictly before asOf. A due
 * date equal to asOf is not overdue.
 */
export function deriveDisplayStatus(input: {
  status: string;
  dueDate: string;
  outstandingPaise: number;
  asOf: string;
}): DisplayStatus {
  const { status, dueDate, outstandingPaise, asOf } = input;
  if (!(KNOWN_STATUSES as readonly string[]).includes(status)) {
    throw new RangeError(`Unknown invoice status "${status}"`);
  }
  assertNonNegativeSafeInteger(outstandingPaise, 'outstandingPaise');
  if (!isRealIsoDate(dueDate)) {
    throw new RangeError(`Invalid dueDate "${dueDate}": expected YYYY-MM-DD`);
  }
  if (!isRealIsoDate(asOf)) {
    throw new RangeError(`Invalid asOf "${asOf}": expected YYYY-MM-DD`);
  }

  const isOpen = isPayableStatus(status) && outstandingPaise > 0;
  if (isOpen && dueDate < asOf) return 'OVERDUE';
  return status as DisplayStatus;
}

export type PayableInvoiceStatus = (typeof PAYABLE_INVOICE_STATUSES)[number];
