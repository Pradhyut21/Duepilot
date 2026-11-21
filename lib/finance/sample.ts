import { buildDailyLedger } from './index';
import { shift } from '@/lib/studio/format';
export const demoAsOf = '2026-11-21';
export const demoBills = [
  {
    name: 'Equipment rental',
    category: 'Equipment rental',
    amount: 25000,
    due: '2026-12-01',
  },
  {
    name: 'Studio rent',
    category: 'Studio rent',
    amount: 9000,
    due: '2026-12-05',
  },
  {
    name: 'Freelance editor',
    category: 'Freelancers',
    amount: 14000,
    due: '2026-12-06',
  },
];
export function previewLedger(delay = 0) {
  return buildDailyLedger({
    openingBalancePaise: 1800000,
    startDate: demoAsOf,
    endDate: '2026-12-12',
    inflows: [
      { date: shift('2026-11-27', delay), amountPaise: 3500000 },
      { date: '2026-12-03', amountPaise: 1200000 },
    ],
    outflows: demoBills.map((e) => ({
      date: e.due,
      amountPaise: e.amount * 100,
    })),
  });
}
