import { buildDailyLedger, expandExpenses } from './index';
import { computeOutstandingPaise } from '@/lib/payments/rules';
import type { Studio } from '@/lib/studio/data';
import { shift } from '@/lib/studio/format';
export type WhatIf = {
  invoiceId?: string;
  days?: number;
  expenseId?: string;
  expensePaise?: number;
};
export type Receipt = {
  invoiceId: string;
  client: string;
  number: string;
  date: string | null;
  amountPaise: number;
  basis: string;
};
export function invoiceBalances(s: Studio) {
  return s.invoices.map((i) => {
    const paid = s.payments
      .filter(
        (p) =>
          p.invoiceId === i.id && !p.reversedAt && p.receivedDate <= s.asOf,
      )
      .reduce((n, p) => n + p.amountPaise, 0);
    return {
      ...i,
      paid,
      outstanding: computeOutstandingPaise(i.totalPaise, paid),
      client: s.clients.find((c) => c.id === i.clientId)?.name ?? 'Client',
    };
  });
}
export function forecast(s: Studio, horizon: number, scenario: WhatIf = {}) {
  if (![30, 60, 90].includes(horizon)) throw Error('Choose 30, 60 or 90 days.');
  const start = s.asOf,
    end = shift(start, horizon - 1),
    openingDate = s.profile.openingBalanceDate ?? '0001-01-01';
  const inPeriod = (d: string) => d >= openingDate && d <= start;
  const actualIn = s.payments
    .filter((p) => !p.reversedAt && inPeriod(p.receivedDate))
    .reduce((n, p) => n + p.amountPaise, 0);
  const billPaid = s.billPayments.map((p) => ({
    ...p,
    amount: s.expenses.find((e) => e.id === p.expenseId)!.amountPaise,
  }));
  const legacyPaid = s.expenses.filter(
    (e) =>
      e.paidDate &&
      e.status === 'PAID' &&
      !billPaid.some((p) => p.expenseId === e.id && p.occurrence === e.dueDate),
  );
  const actualOut =
    billPaid
      .filter((p) => inPeriod(p.paidDate))
      .reduce((n, p) => n + p.amount, 0) +
    legacyPaid
      .filter((e) => inPeriod(e.paidDate!))
      .reduce((n, e) => n + e.amountPaise, 0);
  const cash = s.profile.openingBalancePaise + actualIn - actualOut;
  const invoices = invoiceBalances(s).filter(
    (i) => i.status !== 'DRAFT' && i.outstanding > 0,
  );
  const receipts: Receipt[] = [];
  for (const i of invoices) {
    const add = (amountPaise: number, date: string | null, basis: string) => {
      if (!amountPaise) return;
      receipts.push({
        invoiceId: i.id,
        client: i.client,
        number: i.invoiceNumber,
        amountPaise,
        date:
          date && scenario.invoiceId === i.id
            ? shift(date, scenario.days || 0)
            : date,
        basis,
      });
    };
    if (i.disputed) {
      add(i.outstanding, null, 'Disputed · excluded');
      continue;
    }
    const p = s.promises.find(
      (p) =>
        p.invoiceId === i.id &&
        p.confirmationStatus === 'CONFIRMED' &&
        !p.supersededAt,
    );
    const promised = p
      ? Math.min(
          i.outstanding,
          Math.max(
            0,
            p.promisedAmountPaise - Math.max(0, i.paid - p.paidAtConfirmation),
          ),
        )
      : 0;
    if (p && promised)
      add(
        promised,
        p.promisedDate >= start ? p.promisedDate : null,
        p.promisedDate >= start
          ? 'Confirmed promise'
          : 'Missed promise · new date needed',
      );
    let allocated = i.paid + promised,
      left = i.outstanding - promised;
    const milestones = s.milestones
      .filter((m) => m.invoiceId === i.id)
      .sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
      );
    for (const m of milestones) {
      const used = Math.min(allocated, m.expectedAmountPaise);
      allocated -= used;
      const amt = Math.min(left, m.expectedAmountPaise - used);
      left -= amt;
      const date =
        m.expectedPaymentDate || (s.profile.useDueDates ? m.dueDate : null);
      add(
        amt,
        date && date >= start ? date : null,
        date && date >= start
          ? m.expectedPaymentDate
            ? 'Confirmed milestone'
            : 'Milestone due date'
          : 'Milestone needs a revised date',
      );
    }
    if (left)
      add(
        left,
        s.profile.useDueDates && i.dueDate >= start ? i.dueDate : null,
        s.profile.useDueDates && i.dueDate >= start
          ? 'Invoice due date'
          : 'No confirmed future date',
      );
  }
  const outflows = s.expenses
    .flatMap((e) => {
      if (!e.recurrenceRule && e.status === 'PAID') return [];
      const settled = new Set(
        billPaid.filter((p) => p.expenseId === e.id).map((p) => p.occurrence),
      );
      if (e.status === 'PAID') settled.add(e.dueDate);
      return expandExpenses(
        [
          {
            id: e.id,
            amountPaise:
              scenario.expenseId === e.id
                ? (scenario.expensePaise ?? e.amountPaise)
                : e.amountPaise,
            dueDate: e.dueDate,
            status: 'UNPAID',
            recurrenceRule: e.recurrenceRule,
          },
        ],
        e.dueDate,
        end,
      )
        .filter((o) => !settled.has(o.date))
        .map((o) => ({
          ...o,
          occurrence: o.date,
          date: o.date < start ? start : o.date,
          description: e.description,
        }));
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const dated = receipts.filter(
    (r): r is Receipt & { date: string } => r.date !== null,
  );
  const ledger = buildDailyLedger({
    openingBalancePaise: cash,
    startDate: start,
    endDate: end,
    inflows: dated,
    outflows,
  });
  const negative = ledger.days.filter((d) => d.closingBalancePaise < 0);
  const lowest = ledger.days.reduce((a, d) =>
    a.closingBalancePaise <= d.closingBalancePaise ? a : d,
  );
  const sum = (rows: { amountPaise: number }[]) =>
    rows.reduce((n, v) => n + v.amountPaise, 0);
  return {
    cash,
    actualIn,
    actualOut,
    invoices,
    receipts,
    outflows,
    ...ledger,
    lowest,
    negativeDays: negative.length,
    outstanding: invoices.reduce((n, i) => n + i.outstanding, 0),
    overdue: invoices
      .filter((i) => i.dueDate < start)
      .reduce((n, i) => n + i.outstanding, 0),
    unpaidBills30: sum(outflows.filter((o) => o.date < shift(start, 30))),
    expected: sum(dated.filter((r) => r.date <= end)),
    unforecasted: sum(receipts.filter((r) => !r.date)),
    beyond: sum(dated.filter((r) => r.date > end)),
    end,
  };
}
export type Forecast = ReturnType<typeof forecast>;
