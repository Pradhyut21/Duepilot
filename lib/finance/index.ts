/**
 * DuePilot finance engine.
 *
 * Phase 2+ will add deterministic financial logic here: invoice totals, payment
 * allocation, expense scheduling, the daily ledger and the forecast engine.
 * All money is handled as integer paise (INR, Asia/Kolkata).
 */
export const finance = {};

export type InvoiceItemInput = {
  lineTotalPaise: number;
  taxRateBp: number | null;
};

export type InvoiceTotals = {
  subtotalPaise: number;
  taxAmountPaise: number;
  totalPaise: number;
};

export type InvoiceOutstanding = {
  id: string;
  outstandingPaise: number;
  dueDate: string;
};

export type PaymentAllocation = {
  invoiceId: string;
  allocatedPaise: number;
};

export type PaymentAllocationResult = {
  allocations: PaymentAllocation[];
  unallocatedPaise: number;
};

export type ExpenseInput = {
  id: string;
  amountPaise: number;
  dueDate: string;
  status: 'UNPAID' | 'PAID';
  recurrenceRule: string | null;
};

export type ExpenseOutflow = {
  expenseId: string;
  date: string;
  amountPaise: number;
};

export type LedgerFlow = {
  date: string;
  amountPaise: number;
};

export type DailyLedgerInput = {
  openingBalancePaise: number;
  startDate: string;
  endDate: string;
  inflows: LedgerFlow[];
  outflows: LedgerFlow[];
};

export type LedgerDay = {
  date: string;
  inflowPaise: number;
  outflowPaise: number;
  closingBalancePaise: number;
};

export type DailyLedger = {
  days: LedgerDay[];
  firstNegativeDate: string | null;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const BASIS_POINTS_DENOMINATOR = 10_000;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer (got ${value})`);
  }
}

/** Parses a YYYY-MM-DD string into a UTC day number, rejecting impossible dates. */
function dayNumber(date: string): number {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new RangeError(`Invalid date "${date}": expected YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date "${date}": not a real calendar date`);
  }
  return ms / MS_PER_DAY;
}

/** Formats a UTC day number back to a YYYY-MM-DD string. */
function formatDay(dayNum: number): string {
  return new Date(dayNum * MS_PER_DAY).toISOString().slice(0, 10);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Adds whole months to an anchor date, clamping the day to the last day of
 * the target month. Always counts from the anchor, so Jan 31 + 2 months is Mar 31.
 */
function addMonthsClamped(anchor: string, months: number): string {
  const [year, month, day] = anchor.split('-').map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${String(targetYear).padStart(4, '0')}-${pad2(targetMonth + 1)}-${pad2(targetDay)}`;
}

/**
 * Computes an invoice's subtotal, tax and total. Each line's tax is rounded
 * half-up to whole paise on its own; the subtotal is the sum of line totals.
 */
export function computeInvoiceTotals(items: InvoiceItemInput[]): InvoiceTotals {
  let subtotalPaise = 0;
  let taxAmountPaise = 0;

  for (const item of items) {
    assertSafeInteger(item.lineTotalPaise, 'lineTotalPaise');
    subtotalPaise += item.lineTotalPaise;
    assertSafeInteger(subtotalPaise, 'subtotalPaise');

    if (item.taxRateBp !== null) {
      assertSafeInteger(item.taxRateBp, 'taxRateBp');
      const product = item.lineTotalPaise * item.taxRateBp;
      assertSafeInteger(product, 'line tax product');
      const lineTax = Math.round(product / BASIS_POINTS_DENOMINATOR);
      taxAmountPaise += lineTax;
      assertSafeInteger(taxAmountPaise, 'taxAmountPaise');
    }
  }

  const totalPaise = subtotalPaise + taxAmountPaise;
  assertSafeInteger(totalPaise, 'totalPaise');
  return { subtotalPaise, taxAmountPaise, totalPaise };
}

/**
 * Applies a payment to invoices, oldest dueDate first (ties broken by id).
 * Invoices with nothing outstanding receive no allocation. Any money left
 * after every invoice is covered is returned as unallocatedPaise.
 */
export function allocatePayment(
  amountPaise: number,
  invoices: InvoiceOutstanding[],
): PaymentAllocationResult {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new RangeError(`amountPaise must be a positive integer (got ${amountPaise})`);
  }

  for (const invoice of invoices) {
    assertSafeInteger(invoice.outstandingPaise, 'outstandingPaise');
    if (invoice.outstandingPaise < 0) {
      throw new RangeError(`outstandingPaise must not be negative (got ${invoice.outstandingPaise})`);
    }
    dayNumber(invoice.dueDate);
  }

  const ordered = [...invoices].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });

  let remaining = amountPaise;
  const allocations: PaymentAllocation[] = [];

  for (const invoice of ordered) {
    if (remaining === 0) break;
    if (invoice.outstandingPaise === 0) continue;
    const allocatedPaise = Math.min(remaining, invoice.outstandingPaise);
    allocations.push({ invoiceId: invoice.id, allocatedPaise });
    remaining -= allocatedPaise;
  }

  return { allocations, unallocatedPaise: remaining };
}

/**
 * Produces dated outflows for expenses within an inclusive window. PAID
 * expenses are skipped. One-off expenses (recurrenceRule null) are included
 * when their dueDate falls in the window. MONTHLY and WEEKLY expenses repeat
 * from dueDate. Any other recurrenceRule throws. Output is sorted by date,
 * then expenseId.
 */
export function expandExpenses(
  expenses: ExpenseInput[],
  windowStart: string,
  windowEnd: string,
): ExpenseOutflow[] {
  const startNum = dayNumber(windowStart);
  const endNum = dayNumber(windowEnd);
  const outflows: ExpenseOutflow[] = [];

  for (const expense of expenses) {
    const rule = expense.recurrenceRule;
    if (rule !== null && rule !== 'MONTHLY' && rule !== 'WEEKLY') {
      throw new Error(
        `Unsupported recurrenceRule "${rule}" on expense "${expense.id}" (expected null, 'MONTHLY' or 'WEEKLY')`,
      );
    }
    assertSafeInteger(expense.amountPaise, 'amountPaise');
    dayNumber(expense.dueDate);

    if (expense.status === 'PAID') continue;

    const push = (date: string) => {
      outflows.push({ expenseId: expense.id, date, amountPaise: expense.amountPaise });
    };

    if (rule === null) {
      const num = dayNumber(expense.dueDate);
      if (num >= startNum && num <= endNum) push(expense.dueDate);
      continue;
    }

    if (rule === 'MONTHLY') {
      for (let k = 0; ; k++) {
        const date = addMonthsClamped(expense.dueDate, k);
        const num = dayNumber(date);
        if (num > endNum) break;
        if (num >= startNum) push(date);
      }
      continue;
    }

    const anchorNum = dayNumber(expense.dueDate);
    for (let k = 0; ; k++) {
      const num = anchorNum + 7 * k;
      if (num > endNum) break;
      if (num >= startNum) push(formatDay(num));
    }
  }

  outflows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.expenseId !== b.expenseId) return a.expenseId < b.expenseId ? -1 : 1;
    return 0;
  });

  return outflows;
}

/**
 * Builds a per-day cash ledger covering every calendar day from startDate to
 * endDate inclusive. Flows dated outside that range are ignored. Multiple
 * flows on one day are summed. firstNegativeDate is the first day whose
 * closing balance is below zero, or null if the balance never goes negative.
 */
export function buildDailyLedger(input: DailyLedgerInput): DailyLedger {
  const { openingBalancePaise, startDate, endDate, inflows, outflows } = input;
  assertSafeInteger(openingBalancePaise, 'openingBalancePaise');

  const startNum = dayNumber(startDate);
  const endNum = dayNumber(endDate);
  if (endNum < startNum) {
    throw new RangeError(`endDate ${endDate} is before startDate ${startDate}`);
  }

  const inflowByDay = new Map<string, number>();
  for (const flow of inflows) {
    dayNumber(flow.date);
    assertSafeInteger(flow.amountPaise, 'inflow amountPaise');
    inflowByDay.set(flow.date, (inflowByDay.get(flow.date) ?? 0) + flow.amountPaise);
  }

  const outflowByDay = new Map<string, number>();
  for (const flow of outflows) {
    dayNumber(flow.date);
    assertSafeInteger(flow.amountPaise, 'outflow amountPaise');
    outflowByDay.set(flow.date, (outflowByDay.get(flow.date) ?? 0) + flow.amountPaise);
  }

  const days: LedgerDay[] = [];
  let balance = openingBalancePaise;
  let firstNegativeDate: string | null = null;

  for (let num = startNum; num <= endNum; num++) {
    const date = formatDay(num);
    const inflowPaise = inflowByDay.get(date) ?? 0;
    const outflowPaise = outflowByDay.get(date) ?? 0;
    balance += inflowPaise - outflowPaise;
    assertSafeInteger(balance, 'closingBalancePaise');
    if (balance < 0 && firstNegativeDate === null) firstNegativeDate = date;
    days.push({ date, inflowPaise, outflowPaise, closingBalancePaise: balance });
  }

  return { days, firstNegativeDate };
}
