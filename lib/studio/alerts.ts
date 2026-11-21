import type { Studio } from './data';
import type { Forecast } from '@/lib/finance/forecast';
import { dayDiff, dayLabel, money, shift } from './format';
export function studioAlerts(s: Studio, f: Forecast) {
  const rows: {
    key: string;
    title: string;
    severity: string;
    explanation: string;
    next: string;
    link: string;
  }[] = [];
  for (const i of f.invoices) {
    const link = '/app/invoices/' + i.id;
    const missed = f.receipts.find(
      (r) => r.invoiceId === i.id && r.basis.startsWith('Missed'),
    );
    if (i.dueDate < s.asOf)
      rows.push({
        key: 'late-' + i.id + i.dueDate + i.outstanding,
        title: i.client + ' · overdue invoice',
        severity: 'Overdue',
        explanation:
          i.invoiceNumber +
          ' has ' +
          money(i.outstanding) +
          ' outstanding, ' +
          dayDiff(i.dueDate, s.asOf) +
          ' days past its due date.',
        next: 'Prepare a follow-up',
        link: link + '#reminder',
      });
    if (missed)
      rows.push({
        key:
          'missed-' +
          i.id +
          missed.amountPaise +
          s.promises.find((p) => p.invoiceId === i.id && !p.supersededAt)
            ?.promisedDate,
        title: 'Payment promise needs review',
        severity: 'Review',
        explanation:
          i.client +
          ' has ' +
          money(missed.amountPaise) +
          ' past the confirmed payment date.',
        next: 'Review promise',
        link: link + '#promise',
      });
    if (i.disputed || f.receipts.some((r) => r.invoiceId === i.id && !r.date))
      rows.push({
        key: 'review-' + i.id + i.outstanding + i.disputed,
        title: i.invoiceNumber + ' · review payment information',
        severity: 'Review',
        explanation: i.disputed
          ? 'This invoice is disputed. Its balance is excluded from expected receipts.'
          : 'An outstanding amount has no usable future payment date.',
        next: 'Review invoice',
        link,
      });
  }
  for (const o of f.outflows.filter((o) => o.date <= shift(s.asOf, 14)))
    rows.push({
      key: 'bill-' + o.expenseId + o.occurrence + o.amountPaise,
      title: o.description,
      severity: 'Bill due',
      explanation:
        money(o.amountPaise) +
        ' is due ' +
        dayLabel(o.occurrence) +
        '. This occurrence is still unpaid.',
      next: 'Review bill',
      link: '/app/expenses#bill-' + o.expenseId,
    });
  if (f.firstNegativeDate)
    rows.unshift({
      key: 'gap-' + f.firstNegativeDate + f.lowest.closingBalancePaise,
      title: 'Projected cash shortfall',
      severity: 'High',
      explanation:
        'The projected balance first falls below zero on ' +
        dayLabel(f.firstNegativeDate) +
        ' and reaches ' +
        money(f.lowest.closingBalancePaise) +
        '.',
      next: 'Review forecast',
      link: '/app/forecast',
    });
  return rows.map((r) => ({
    ...r,
    status: s.alerts.find((a) => a.relatedEntity === r.key)?.status ?? 'OPEN',
  }));
}
