import { describe, it, expect } from 'vitest';
import {
  PAYABLE_INVOICE_STATUSES,
  PaymentExceedsOutstandingError,
  assertPaymentWithinOutstanding,
  computeOutstandingPaise,
  deriveDisplayStatus,
  isPayableStatus,
  sumPayableOutstanding,
} from '../lib/payments/rules';

describe('isPayableStatus', () => {
  it('treats DRAFT as not payable', () => {
    expect(isPayableStatus('DRAFT')).toBe(false);
  });

  it('treats ISSUED and PARTIALLY_PAID as payable', () => {
    expect(isPayableStatus('ISSUED')).toBe(true);
    expect(isPayableStatus('PARTIALLY_PAID')).toBe(true);
    expect(PAYABLE_INVOICE_STATUSES).toEqual(['ISSUED', 'PARTIALLY_PAID']);
  });

  it('treats PAID as not payable', () => {
    expect(isPayableStatus('PAID')).toBe(false);
  });
});

describe('computeOutstandingPaise', () => {
  it('returns total minus paid', () => {
    expect(computeOutstandingPaise(100000, 25000)).toBe(75000);
  });

  it('returns zero when fully paid', () => {
    expect(computeOutstandingPaise(100000, 100000)).toBe(0);
  });

  it('throws when paid exceeds total', () => {
    expect(() => computeOutstandingPaise(100000, 100001)).toThrow();
  });

  it('throws on negative or non-integer inputs', () => {
    expect(() => computeOutstandingPaise(-1, 0)).toThrow();
    expect(() => computeOutstandingPaise(100, -1)).toThrow();
    expect(() => computeOutstandingPaise(10.5, 0)).toThrow();
    expect(() => computeOutstandingPaise(100, 0.5)).toThrow();
    expect(() => computeOutstandingPaise(Number.MAX_SAFE_INTEGER + 1, 0)).toThrow();
  });
});

describe('sumPayableOutstanding', () => {
  it('ignores drafts, paid invoices and zero-outstanding invoices', () => {
    const result = sumPayableOutstanding([
      { id: 'a', status: 'ISSUED', totalPaise: 10000, paidPaise: 0 },
      { id: 'b', status: 'DRAFT', totalPaise: 50000, paidPaise: 0 },
      { id: 'c', status: 'PARTIALLY_PAID', totalPaise: 20000, paidPaise: 5000 },
      { id: 'd', status: 'PAID', totalPaise: 30000, paidPaise: 30000 },
      { id: 'e', status: 'ISSUED', totalPaise: 4000, paidPaise: 4000 },
    ]);
    expect(result.payableOutstandingPaise).toBe(25000);
    expect(result.payableInvoiceIds).toEqual(['a', 'c']);
  });

  it('returns zero for an empty list or only drafts', () => {
    expect(sumPayableOutstanding([])).toEqual({ payableOutstandingPaise: 0, payableInvoiceIds: [] });
    expect(
      sumPayableOutstanding([{ id: 'x', status: 'DRAFT', totalPaise: 900, paidPaise: 0 }]),
    ).toEqual({ payableOutstandingPaise: 0, payableInvoiceIds: [] });
  });
});

describe('assertPaymentWithinOutstanding', () => {
  it('accepts a payment equal to the outstanding balance', () => {
    expect(() => assertPaymentWithinOutstanding(25000, 25000)).not.toThrow();
  });

  it('accepts a payment below the outstanding balance', () => {
    expect(() => assertPaymentWithinOutstanding(100, 25000)).not.toThrow();
  });

  it('rejects an overpayment with the exact message and outstanding amount', () => {
    let caught: unknown;
    try {
      assertPaymentWithinOutstanding(25001, 25000);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PaymentExceedsOutstandingError);
    const err = caught as PaymentExceedsOutstandingError;
    expect(err.outstandingPaise).toBe(25000);
    expect(err.message).toBe('Only ₹250.00 can be applied. Enter up to ₹250.00.');
  });

  it('throws on negative or non-integer inputs', () => {
    expect(() => assertPaymentWithinOutstanding(-1, 100)).toThrow();
    expect(() => assertPaymentWithinOutstanding(100, -1)).toThrow();
    expect(() => assertPaymentWithinOutstanding(10.5, 100)).toThrow();
    expect(() => assertPaymentWithinOutstanding(100, 99.9)).toThrow();
  });
});

describe('deriveDisplayStatus', () => {
  const base = { dueDate: '2025-03-10', outstandingPaise: 5000, asOf: '2025-03-11' };

  it('is OVERDUE for an open invoice past its due date', () => {
    expect(deriveDisplayStatus({ ...base, status: 'ISSUED' })).toBe('OVERDUE');
    expect(deriveDisplayStatus({ ...base, status: 'PARTIALLY_PAID' })).toBe('OVERDUE');
  });

  it('is not OVERDUE on the due date itself', () => {
    expect(
      deriveDisplayStatus({ ...base, status: 'ISSUED', asOf: '2025-03-10' }),
    ).toBe('ISSUED');
  });

  it('is not OVERDUE before the due date', () => {
    expect(
      deriveDisplayStatus({ ...base, status: 'PARTIALLY_PAID', asOf: '2025-03-09' }),
    ).toBe('PARTIALLY_PAID');
  });

  it('is not OVERDUE when nothing is outstanding, for drafts, or for paid invoices', () => {
    expect(deriveDisplayStatus({ ...base, status: 'ISSUED', outstandingPaise: 0 })).toBe('ISSUED');
    expect(deriveDisplayStatus({ ...base, status: 'DRAFT' })).toBe('DRAFT');
    expect(deriveDisplayStatus({ ...base, status: 'PAID', outstandingPaise: 0 })).toBe('PAID');
  });

  it('throws on negative outstanding or malformed dates', () => {
    expect(() => deriveDisplayStatus({ ...base, status: 'ISSUED', outstandingPaise: -1 })).toThrow();
    expect(() => deriveDisplayStatus({ ...base, status: 'ISSUED', outstandingPaise: 1.5 })).toThrow();
    expect(() => deriveDisplayStatus({ ...base, status: 'ISSUED', asOf: '2025-02-30' })).toThrow();
  });
});
