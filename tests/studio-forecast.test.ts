import { describe, it, expect } from 'vitest';
import type { Studio } from '../lib/studio/data';
import { forecast } from '../lib/finance/forecast';
import { demoBills } from '../lib/finance/sample';
function fixture() {
  return {
    profile: {
      openingBalancePaise: 1800000,
      openingBalanceDate: '2026-11-21',
      useDueDates: true,
    },
    asOf: '2026-11-21',
    clients: [{ id: 'c', name: 'Client A' }],
    invoices: [
      {
        id: 'a',
        clientId: 'c',
        status: 'PARTIALLY_PAID',
        totalPaise: 5500000,
        dueDate: '2026-11-27',
      },
      {
        id: 'b',
        clientId: 'c',
        status: 'ISSUED',
        totalPaise: 1200000,
        dueDate: '2026-12-03',
      },
    ],
    payments: [
      { invoiceId: 'a', amountPaise: 2000000, receivedDate: '2026-11-10' },
    ],
    promises: [
      {
        invoiceId: 'a',
        promisedAmountPaise: 3500000,
        paidAtConfirmation: 2000000,
        promisedDate: '2026-11-27',
        confirmationStatus: 'CONFIRMED',
      },
    ],
    milestones: [],
    expenses: demoBills.map((e) => ({
      id: e.name,
      description: e.name,
      amountPaise: e.amount * 100,
      dueDate: e.due,
      status: 'UNPAID',
      recurrenceRule: null,
    })),
    billPayments: [],
  } as unknown as Studio;
}
describe('studio forecast', () => {
  it('reproduces baseline and all delayed cash checkpoints without changing records', () => {
    const s = fixture(),
      before = JSON.stringify(s),
      base = forecast(s, 30),
      late = forecast(s, 30, { invoiceId: 'a', days: 15 });
    expect(base.lowest.closingBalancePaise).toBe(1700000);
    expect(base.negativeDays).toBe(0);
    expect(late.firstNegativeDate).toBe('2026-12-01');
    expect(late.negativeDays).toBe(9);
    for (const [d, n] of [
      ['01', -700000],
      ['05', -400000],
      ['06', -1800000],
      ['12', 1700000],
    ])
      expect(
        late.days.find((x) => x.date === '2026-12-' + d)?.closingBalancePaise,
      ).toBe(n);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('reduces dated promises after receipts and excludes reversed payments', () => {
    const s = fixture();
    s.payments.push(
      { ...s.payments[0], receivedDate: s.asOf, amountPaise: 300000 },
      {
        ...s.payments[0],
        receivedDate: s.asOf,
        amountPaise: 500000,
        reversedAt: new Date(),
      },
    );
    const f = forecast(s, 60);
    expect(f.cash).toBe(2100000);
    expect(f.expected).toBe(4400000);
    expect(f.days.length).toBe(60);
  });
  it('covers partially satisfied milestones once and exposes undated balances', () => {
    const s = fixture();
    s.promises = [];
    s.milestones = [
      {
        id: 'm',
        invoiceId: 'a',
        expectedAmountPaise: 2500000,
        dueDate: '2026-11-15',
      },
      {
        id: 'n',
        invoiceId: 'a',
        expectedAmountPaise: 3000000,
        dueDate: '2026-12-02',
      },
    ] as Studio['milestones'];
    const f = forecast(s, 30);
    expect(f.unforecasted).toBe(500000);
    expect(f.expected).toBe(4200000);
  });
  it('keeps disputed, missed and beyond-horizon receipts separate', () => {
    const s = fixture();
    s.invoices[0].disputed = true;
    s.invoices[1].dueDate = '2027-02-02';
    const f = forecast(s, 30);
    expect(f.expected).toBe(0);
    expect(f.beyond).toBe(1200000);
    expect(f.unforecasted).toBe(3500000);
    s.invoices[0].disputed = false;
    s.promises[0].promisedDate = '2026-11-20';
    expect(forecast(s, 90).receipts[0].basis).toMatch(/Missed/);
  });
  it('counts a paid recurring occurrence once and keeps future occurrences', () => {
    const s = fixture();
    s.expenses = [
      {
        ...s.expenses[0],
        dueDate: '2026-11-21',
        amountPaise: 15000,
        recurrenceRule: 'MONTHLY',
      },
    ];
    s.billPayments = [
      {
        expenseId: s.expenses[0].id,
        occurrence: s.asOf,
        paidDate: s.asOf,
      } as Studio['billPayments'][number],
    ];
    const f = forecast(s, 60);
    expect(f.actualOut).toBe(15000);
    expect(f.outflows.map((x) => x.date)).toEqual(['2026-12-21']);
    expect(f.cash).toBe(1785000);
  });
  it('handles today, overdue bills, zero records and hypothetical expenses', () => {
    const s = fixture();
    s.invoices = [];
    s.promises = [];
    s.payments = [];
    s.profile.openingBalancePaise = 0;
    s.expenses = [{ ...s.expenses[0], dueDate: '2026-11-20' }];
    expect(
      forecast(s, 30, { expenseId: s.expenses[0].id, expensePaise: 100 }).lowest
        .closingBalancePaise,
    ).toBe(-100);
    expect(forecast(s, 30).outflows[0].date).toBe(s.asOf);
    s.expenses = [];
    expect(forecast(s, 90).lowest.closingBalancePaise).toBe(0);
  });
});
