import { describe, it, expect } from 'vitest';
import {
  computeInvoiceTotals,
  allocatePayment,
  expandExpenses,
  buildDailyLedger,
} from '../lib/finance';

describe('computeInvoiceTotals', () => {
  it('returns zero totals for an invoice with no items', () => {
    expect(computeInvoiceTotals([])).toEqual({
      subtotalPaise: 0,
      taxAmountPaise: 0,
      totalPaise: 0,
    });
  });

  it('adds no tax when taxRateBp is null', () => {
    expect(
      computeInvoiceTotals([{ lineTotalPaise: 10000, taxRateBp: null }]),
    ).toEqual({ subtotalPaise: 10000, taxAmountPaise: 0, totalPaise: 10000 });
  });

  it('computes 18% tax from basis points', () => {
    expect(
      computeInvoiceTotals([{ lineTotalPaise: 10000, taxRateBp: 1800 }]),
    ).toEqual({ subtotalPaise: 10000, taxAmountPaise: 1800, totalPaise: 11800 });
  });

  it('rounds an exactly-half paise tax amount up', () => {
    // 5000 * 1 / 10000 = 0.5 -> rounds to 1
    expect(
      computeInvoiceTotals([{ lineTotalPaise: 5000, taxRateBp: 1 }]),
    ).toEqual({ subtotalPaise: 5000, taxAmountPaise: 1, totalPaise: 5001 });
  });

  it('rounds tax per line and sums the rounded amounts', () => {
    // line A: 2500 * 1 / 10000 = 0.25 -> 0 ; line B: 7500 * 1 / 10000 = 0.75 -> 1
    expect(
      computeInvoiceTotals([
        { lineTotalPaise: 2500, taxRateBp: 1 },
        { lineTotalPaise: 7500, taxRateBp: 1 },
      ]),
    ).toEqual({ subtotalPaise: 10000, taxAmountPaise: 1, totalPaise: 10001 });
  });

  it('rejects non-integer line amounts', () => {
    expect(() =>
      computeInvoiceTotals([{ lineTotalPaise: 10.5, taxRateBp: null }]),
    ).toThrow();
  });

  it('rejects unsafe integer line amounts', () => {
    expect(() =>
      computeInvoiceTotals([{ lineTotalPaise: Number.MAX_SAFE_INTEGER + 2, taxRateBp: null }]),
    ).toThrow();
  });
});

describe('allocatePayment', () => {
  it('returns no allocations and the full amount unallocated when there are no invoices', () => {
    expect(allocatePayment(5000, [])).toEqual({
      allocations: [],
      unallocatedPaise: 5000,
    });
  });

  it('partially pays a single invoice when the payment is smaller than the outstanding balance', () => {
    expect(
      allocatePayment(5000, [{ id: 'inv-1', outstandingPaise: 10000, dueDate: '2025-03-01' }]),
    ).toEqual({
      allocations: [{ invoiceId: 'inv-1', allocatedPaise: 5000 }],
      unallocatedPaise: 0,
    });
  });

  it('allocates to the oldest due date first', () => {
    expect(
      allocatePayment(5000, [
        { id: 'newer', outstandingPaise: 3000, dueDate: '2025-02-01' },
        { id: 'older', outstandingPaise: 4000, dueDate: '2025-01-15' },
      ]),
    ).toEqual({
      allocations: [
        { invoiceId: 'older', allocatedPaise: 4000 },
        { invoiceId: 'newer', allocatedPaise: 1000 },
      ],
      unallocatedPaise: 0,
    });
  });

  it('breaks due date ties by id', () => {
    expect(
      allocatePayment(1000, [
        { id: 'b', outstandingPaise: 800, dueDate: '2025-01-10' },
        { id: 'a', outstandingPaise: 800, dueDate: '2025-01-10' },
      ]),
    ).toEqual({
      allocations: [
        { invoiceId: 'a', allocatedPaise: 800 },
        { invoiceId: 'b', allocatedPaise: 200 },
      ],
      unallocatedPaise: 0,
    });
  });

  it('reports over-payment as unallocated money', () => {
    expect(
      allocatePayment(20000, [
        { id: 'a', outstandingPaise: 4000, dueDate: '2025-01-01' },
        { id: 'b', outstandingPaise: 3000, dueDate: '2025-01-02' },
      ]),
    ).toEqual({
      allocations: [
        { invoiceId: 'a', allocatedPaise: 4000 },
        { invoiceId: 'b', allocatedPaise: 3000 },
      ],
      unallocatedPaise: 13000,
    });
  });

  it('rejects a zero amount', () => {
    expect(() => allocatePayment(0, [])).toThrow();
  });

  it('rejects a negative amount', () => {
    expect(() => allocatePayment(-100, [])).toThrow();
  });

  it('rejects a non-integer amount', () => {
    expect(() => allocatePayment(1.5, [])).toThrow();
  });
});

describe('expandExpenses', () => {
  it('returns an empty list when there are no expenses', () => {
    expect(expandExpenses([], '2025-01-01', '2025-12-31')).toEqual([]);
  });

  it('includes a one-off expense whose dueDate is on the window boundaries', () => {
    const expenses = [
      { id: 'e1', amountPaise: 1000, dueDate: '2025-01-01', status: 'UNPAID' as const, recurrenceRule: null },
      { id: 'e2', amountPaise: 2000, dueDate: '2025-01-31', status: 'UNPAID' as const, recurrenceRule: null },
    ];
    expect(expandExpenses(expenses, '2025-01-01', '2025-01-31')).toEqual([
      { expenseId: 'e1', date: '2025-01-01', amountPaise: 1000 },
      { expenseId: 'e2', date: '2025-01-31', amountPaise: 2000 },
    ]);
  });

  it('excludes a one-off expense outside the window', () => {
    const expenses = [
      { id: 'e1', amountPaise: 1000, dueDate: '2025-02-01', status: 'UNPAID' as const, recurrenceRule: null },
    ];
    expect(expandExpenses(expenses, '2025-01-01', '2025-01-31')).toEqual([]);
  });

  it('expands MONTHLY from a Jan 31 anchor, clamping to month end and returning to the anchor day', () => {
    const expenses = [
      { id: 'rent', amountPaise: 50000, dueDate: '2025-01-31', status: 'UNPAID' as const, recurrenceRule: 'MONTHLY' },
    ];
    expect(expandExpenses(expenses, '2025-01-01', '2025-04-30')).toEqual([
      { expenseId: 'rent', date: '2025-01-31', amountPaise: 50000 },
      { expenseId: 'rent', date: '2025-02-28', amountPaise: 50000 },
      { expenseId: 'rent', date: '2025-03-31', amountPaise: 50000 },
      { expenseId: 'rent', date: '2025-04-30', amountPaise: 50000 },
    ]);
  });

  it('expands MONTHLY across a leap-year February', () => {
    const expenses = [
      { id: 'rent', amountPaise: 50000, dueDate: '2024-01-31', status: 'UNPAID' as const, recurrenceRule: 'MONTHLY' },
    ];
    expect(expandExpenses(expenses, '2024-02-01', '2024-03-31')).toEqual([
      { expenseId: 'rent', date: '2024-02-29', amountPaise: 50000 },
      { expenseId: 'rent', date: '2024-03-31', amountPaise: 50000 },
    ]);
  });

  it('expands WEEKLY occurrences every seven days inside the window', () => {
    const expenses = [
      { id: 'cook', amountPaise: 700, dueDate: '2025-01-06', status: 'UNPAID' as const, recurrenceRule: 'WEEKLY' },
    ];
    expect(expandExpenses(expenses, '2025-01-01', '2025-01-20')).toEqual([
      { expenseId: 'cook', date: '2025-01-06', amountPaise: 700 },
      { expenseId: 'cook', date: '2025-01-13', amountPaise: 700 },
      { expenseId: 'cook', date: '2025-01-20', amountPaise: 700 },
    ]);
  });

  it('skips expenses whose status is PAID', () => {
    const expenses = [
      { id: 'paid', amountPaise: 1000, dueDate: '2025-01-10', status: 'PAID' as const, recurrenceRule: null },
    ];
    expect(expandExpenses(expenses, '2025-01-01', '2025-01-31')).toEqual([]);
  });

  it('throws for an unrecognised recurrenceRule', () => {
    const expenses = [
      { id: 'bad', amountPaise: 1000, dueDate: '2025-01-10', status: 'UNPAID' as const, recurrenceRule: 'DAILY' },
    ];
    expect(() => expandExpenses(expenses, '2025-01-01', '2025-01-31')).toThrow(/recurrenceRule/);
  });
});

describe('buildDailyLedger', () => {
  it('returns every day with a flat balance when there are no flows', () => {
    expect(
      buildDailyLedger({
        openingBalancePaise: 1000,
        startDate: '2025-01-01',
        endDate: '2025-01-03',
        inflows: [],
        outflows: [],
      }),
    ).toEqual({
      days: [
        { date: '2025-01-01', inflowPaise: 0, outflowPaise: 0, closingBalancePaise: 1000 },
        { date: '2025-01-02', inflowPaise: 0, outflowPaise: 0, closingBalancePaise: 1000 },
        { date: '2025-01-03', inflowPaise: 0, outflowPaise: 0, closingBalancePaise: 1000 },
      ],
      firstNegativeDate: null,
    });
  });

  it('reports the first day the closing balance goes negative', () => {
    expect(
      buildDailyLedger({
        openingBalancePaise: 1000,
        startDate: '2025-01-01',
        endDate: '2025-01-04',
        inflows: [{ date: '2025-01-02', amountPaise: 500 }],
        outflows: [
          { date: '2025-01-01', amountPaise: 800 },
          { date: '2025-01-03', amountPaise: 1000 },
        ],
      }),
    ).toEqual({
      days: [
        { date: '2025-01-01', inflowPaise: 0, outflowPaise: 800, closingBalancePaise: 200 },
        { date: '2025-01-02', inflowPaise: 500, outflowPaise: 0, closingBalancePaise: 700 },
        { date: '2025-01-03', inflowPaise: 0, outflowPaise: 1000, closingBalancePaise: -300 },
        { date: '2025-01-04', inflowPaise: 0, outflowPaise: 0, closingBalancePaise: -300 },
      ],
      firstNegativeDate: '2025-01-03',
    });
  });

  it('aggregates multiple flows on the same day', () => {
    const result = buildDailyLedger({
      openingBalancePaise: 0,
      startDate: '2025-01-01',
      endDate: '2025-01-01',
      inflows: [
        { date: '2025-01-01', amountPaise: 300 },
        { date: '2025-01-01', amountPaise: 200 },
      ],
      outflows: [{ date: '2025-01-01', amountPaise: 100 }],
    });
    expect(result.days).toEqual([
      { date: '2025-01-01', inflowPaise: 500, outflowPaise: 100, closingBalancePaise: 400 },
    ]);
  });

  it('steps through month boundaries one calendar day at a time', () => {
    const result = buildDailyLedger({
      openingBalancePaise: 0,
      startDate: '2024-02-28',
      endDate: '2024-03-01',
      inflows: [],
      outflows: [],
    });
    expect(result.days.map((d) => d.date)).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
  });

  it('throws when endDate is before startDate', () => {
    expect(() =>
      buildDailyLedger({
        openingBalancePaise: 0,
        startDate: '2025-01-05',
        endDate: '2025-01-01',
        inflows: [],
        outflows: [],
      }),
    ).toThrow();
  });
});
