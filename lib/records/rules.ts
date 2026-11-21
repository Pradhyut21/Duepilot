/**
 * Pure record-validation and arithmetic rules for invoices and expenses.
 * All money is integer paise, quantities are integer thousandths and tax
 * rates are integer basis points. No floating-point arithmetic is used for
 * stored values.
 */

export type RecurrenceRule = 'MONTHLY' | 'WEEKLY';

/** Formats a sequence number as an invoice number, e.g. 1 -> "INV-0001". */
export function formatInvoiceNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Invoice sequence must be a positive integer');
  }
  return `INV-${String(sequence).padStart(4, '0')}`;
}

/**
 * Parses a decimal quantity string with up to three decimals into integer
 * thousandths, e.g. "1.5" -> 1500. Rejects zero, negatives and excess decimals.
 */
export function parseQuantityThousandths(input: string): number {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(input.trim());
  if (!match) {
    throw new Error('Quantity must be a number with at most three decimals');
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(3, '0'));
  const thousandths = whole * 1000 + fraction;
  if (thousandths <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  return thousandths;
}

/**
 * Parses a percentage string with up to two decimals into integer basis
 * points, e.g. "18" -> 1800, "5.5" -> 550. Must be between 0 and 100.
 */
export function parseTaxRateBp(input: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) {
    throw new Error('Tax rate must be a number with at most two decimals');
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const bp = whole * 100 + fraction;
  if (bp < 0 || bp > 10000) {
    throw new Error('Tax rate must be between 0 and 100 percent');
  }
  return bp;
}

/**
 * Line total in paise: quantity (thousandths) x unit price (paise), rounded
 * half up to whole paise. Uses integer math only.
 */
export function lineTotalPaise(quantityThousandths: number, unitPricePaise: number): number {
  if (!Number.isInteger(quantityThousandths) || !Number.isInteger(unitPricePaise)) {
    throw new Error('Quantity and unit price must be integers');
  }
  const product = quantityThousandths * unitPricePaise;
  return Math.floor((product + 500) / 1000);
}

/**
 * Maps the recurrence form choice to a stored rule. The empty choice (or null)
 * means a one-off expense and maps to null. Anything else is rejected.
 */
export function mapRecurrenceRule(input: string | null | undefined): RecurrenceRule | null {
  if (input === '' || input === null || input === undefined) {
    return null;
  }
  if (input === 'MONTHLY' || input === 'WEEKLY') {
    return input;
  }
  throw new Error(`Unsupported recurrence rule: ${input}`);
}

/**
 * True only for YYYY-MM-DD strings that name a real calendar date.
 */
export function isValidIsoDate(input: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}
