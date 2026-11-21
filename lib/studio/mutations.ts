import { z } from 'zod';
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db/client';
import { isValidIsoDate } from '@/lib/records/rules';
import { parseRupeesToPaise } from '@/lib/money';
import { expandExpenses } from '@/lib/finance';
import { todayInTimezone } from '@/lib/records/invoice-dates';
import { DEMO_DATE } from './data';
export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function ensure(v: unknown, message: string, status = 400): asserts v {
  if (!v) throw new StudioError(message, status);
}
const uuid = z.string().uuid(),
  title = z.string().trim().min(1).max(180),
  notes = z.string().trim().max(2500).default('');
const day = z
  .string()
  .refine(
    (s) => isValidIsoDate(s) && s >= '2000-01-01' && s <= '2100-12-31',
    'Enter a valid date between 2000 and 2100.',
  );
const rupees = z
  .string()
  .max(20)
  .transform((v, ctx) => {
    try {
      return parseRupeesToPaise(v);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid INR amount with up to two decimal places.',
      });
      return z.NEVER;
    }
  });
export const positive = rupees.refine((v) => v > 0, 'Enter a positive amount.');
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
export async function log(
  c: PoolClient,
  b: string,
  u: string,
  event: string,
  entity: string,
  id: string,
  before: unknown = null,
  after: unknown = null,
) {
  await c.query(
    'INSERT INTO activities(business_id,actor_user_id,event_type,entity_type,entity_id,before_json,after_json) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [b, u, event, entity, id, before, after],
  );
}
const tables = [
  'invoices',
  'clients',
  'expenses',
  'payments',
  'reminder_drafts',
  'projects',
] as const;
async function owned(
  c: PoolClient,
  b: string,
  table: (typeof tables)[number],
  id: string,
) {
  const {
    rows: [r],
  } = await c.query(
    'SELECT * FROM ' + table + ' WHERE business_id=$1 AND id=$2 FOR UPDATE',
    [b, id],
  );
  ensure(r, 'Record not found in this studio.', 404);
  return r;
}
async function totalPaid(c: PoolClient, b: string, i: string) {
  return Number(
    (
      await c.query(
        'SELECT COALESCE(sum(amount_paise),0) AS paid FROM payments WHERE business_id=$1 AND invoice_id=$2 AND reversed_at IS NULL',
        [b, i],
      )
    ).rows[0].paid,
  );
}
export const scenarioFields = z.object({
  invoiceId: z.union([uuid, z.literal('')]).default(''),
  days: z.coerce.number().int().min(0).max(365),
  expenseId: z.union([uuid, z.literal('')]).default(''),
  expenseAmount: z.string().max(20).default(''),
});
export async function mutate(b: string, u: string, kind: string, raw: unknown) {
  return transaction(async (c) => {
    const {
      rows: [studio],
    } = await c.query(
      'SELECT b.* FROM businesses b JOIN business_memberships m ON m.business_id=b.id WHERE b.id=$1 AND m.user_id=$2 FOR UPDATE OF b',
      [b, u],
    );
    ensure(studio, 'Studio unavailable.', 403);
    const today = studio.is_demo ? DEMO_DATE : todayInTimezone('Asia/Kolkata');
    if (kind === 'demo.reset') {
      ensure(studio.is_demo, 'Only demo workspaces can be reset.', 403);
      for (const table of [
        'activities',
        'alerts',
        'scenarios',
        'reminder_drafts',
        'payment_promises',
        'payments',
        'expenses',
        'invoices',
        'projects',
        'clients',
        'invoice_counters',
      ])
        await c.query('DELETE FROM ' + table + ' WHERE business_id=$1', [b]);
      await c.query(
        "UPDATE businesses SET name='Aperture Studio',business_type='Wedding photography',horizon=30,use_due_dates=true,opening_balance_paise=1800000,opening_balance_date='2026-11-21',logo=null WHERE id=$1",
        [b],
      );
      const { seed } = await import('./demo');
      await seed(c, b, u);
      return {};
    }
    if (kind === 'profile') {
      const p = z
        .object({
          name: title,
          owner: title,
          type: title,
          opening: rupees,
          openingDate: day,
          horizon: z.coerce.number().refine((n) => [30, 60, 90].includes(n)),
          useDue: z.string().optional(),
          logo: z
            .string()
            .max(90000)
            .regex(/^(|data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/]+=*)$/)
            .default(''),
        })
        .parse(raw);
      ensure(p.openingDate <= today, 'Opening date cannot be in the future.');
      await c.query(
        'UPDATE businesses SET name=$2,business_type=$3,opening_balance_paise=$4,opening_balance_date=$5,horizon=$6,use_due_dates=$7,logo=$8,updated_at=now() WHERE id=$1',
        [
          b,
          p.name,
          p.type,
          p.opening,
          p.openingDate,
          p.horizon,
          p.useDue === 'on',
          p.logo || null,
        ],
      );
      await c.query(
        'UPDATE users SET display_name=$2,updated_at=now() WHERE id=$1',
        [u, p.owner],
      );
      await log(
        c,
        b,
        u,
        'Business profile saved',
        'business',
        b,
        {
          opening: studio.opening_balance_paise,
          date: studio.opening_balance_date,
        },
        { opening: p.opening, date: p.openingDate },
      );
      return {};
    }
    if (kind === 'client.edit' || kind === 'client.archive') {
      const { id } = z.object({ id: uuid }).parse(raw);
      const row = await owned(c, b, 'clients', id);
      if (kind === 'client.archive')
        await c.query(
          'UPDATE clients SET archived_at=CASE WHEN archived_at IS NULL THEN now() ELSE NULL END,updated_at=now() WHERE business_id=$1 AND id=$2',
          [b, id],
        );
      else {
        const p = z
          .object({
            name: title,
            email: z.union([z.string().email().max(254), z.literal('')]),
            phone: z.string().max(40),
            notes,
          })
          .parse(raw);
        await c.query(
          'UPDATE clients SET name=$3,email=$4,phone=$5,notes=$6,updated_at=now() WHERE business_id=$1 AND id=$2',
          [b, id, p.name, p.email, p.phone, p.notes],
        );
      }
      await log(
        c,
        b,
        u,
        kind === 'client.edit'
          ? 'Client updated'
          : row.archived_at
            ? 'Client restored'
            : 'Client archived',
        'client',
        id,
      );
      return {};
    }
    if (kind === 'issue' || kind === 'dispute') {
      const { id } = z.object({ id: uuid }).parse(raw);
      const i = await owned(c, b, 'invoices', id);
      if (kind === 'issue') {
        ensure(
          i.status === 'DRAFT' && i.total_paise > 0,
          'Only a positive draft can be issued.',
        );
        ensure(
          String(
            i.issue_date instanceof Date
              ? i.issue_date.toLocaleDateString('en-CA')
              : i.issue_date,
          ) <= today,
          'Issue date is in the future.',
        );
        await c.query(
          "UPDATE invoices SET status='ISSUED',updated_at=now() WHERE business_id=$1 AND id=$2",
          [b, id],
        );
      } else {
        ensure(i.status !== 'DRAFT', 'Issue this invoice first.');
        await c.query(
          'UPDATE invoices SET disputed=NOT disputed,updated_at=now() WHERE business_id=$1 AND id=$2',
          [b, id],
        );
      }
      await log(
        c,
        b,
        u,
        kind === 'issue'
          ? 'Invoice issued'
          : i.disputed
            ? 'Dispute resolved'
            : 'Dispute opened',
        'invoice',
        id,
        { status: i.status, disputed: i.disputed },
        { number: i.invoice_number },
      );
      return {};
    }
    if (kind === 'payment') {
      const p = z
        .object({
          id: uuid,
          amount: positive,
          date: day,
          method: title,
          reference: notes,
          key: uuid,
          confirmed: z.literal('on'),
        })
        .parse(raw);
      const i = await owned(c, b, 'invoices', p.id);
      const prior = (
        await c.query(
          'SELECT invoice_id,amount_paise,received_date::text,method,reference FROM payments WHERE business_id=$1 AND idempotency_key=$2',
          [b, p.key],
        )
      ).rows[0];
      if (prior) {
        ensure(
          prior.invoice_id === p.id &&
            prior.amount_paise === p.amount &&
            prior.received_date === p.date &&
            prior.method === p.method &&
            prior.reference === p.reference,
          'This submission key already belongs to another payment.',
          409,
        );
        return {};
      }
      ensure(i.status !== 'DRAFT', 'Issue this invoice first.');
      const issue = (
        await c.query(
          'SELECT issue_date::text AS d FROM invoices WHERE business_id=$1 AND id=$2',
          [b, p.id],
        )
      ).rows[0].d;
      ensure(
        p.date <= today && p.date >= issue,
        'Payment date must be between issue date and today.',
      );
      const left = i.total_paise - (await totalPaid(c, b, p.id));
      ensure(p.amount <= left, 'Payment exceeds the outstanding amount.', 409);
      await c.query(
        'INSERT INTO payments(business_id,invoice_id,amount_paise,received_date,method,reference,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [b, p.id, p.amount, p.date, p.method, p.reference, p.key],
      );
      await c.query(
        'UPDATE invoices SET status=$3,updated_at=now() WHERE business_id=$1 AND id=$2',
        [b, p.id, p.amount === left ? 'PAID' : 'PARTIALLY_PAID'],
      );
      await log(
        c,
        b,
        u,
        'Payment recorded',
        'invoice',
        p.id,
        { outstanding: left },
        { amount: p.amount, outstanding: left - p.amount },
      );
      return {};
    }
    if (kind === 'reverse') {
      const p = z
          .object({ id: uuid, reason: title, confirmed: z.literal('on') })
          .parse(raw),
        r = await owned(c, b, 'payments', p.id);
      ensure(!r.reversed_at, 'Already reversed.', 409);
      await owned(c, b, 'invoices', r.invoice_id);
      await c.query(
        'UPDATE payments SET reversed_at=now() WHERE business_id=$1 AND id=$2',
        [b, p.id],
      );
      const paid = await totalPaid(c, b, r.invoice_id);
      await c.query(
        'UPDATE invoices SET status=$3,updated_at=now() WHERE business_id=$1 AND id=$2',
        [b, r.invoice_id, paid ? 'PARTIALLY_PAID' : 'ISSUED'],
      );
      await log(
        c,
        b,
        u,
        'Payment reversed',
        'invoice',
        r.invoice_id,
        { payment: p.id, amount: r.amount_paise },
        { reason: p.reason },
      );
      return {};
    }
    if (kind === 'bill.pay') {
      const p = z
          .object({
            id: uuid,
            occurrence: day,
            paidDate: day,
            confirmed: z.literal('on'),
          })
          .parse(raw),
        e = await owned(c, b, 'expenses', p.id);
      const {
        rows: [{ d }],
      } = await c.query(
        'SELECT due_date::text AS d FROM expenses WHERE business_id=$1 AND id=$2',
        [b, p.id],
      );
      ensure(p.paidDate <= today, 'Payment date cannot be in the future.');
      ensure(
        (e.status !== 'PAID' || (e.recurrence_rule && d !== p.occurrence)) &&
          expandExpenses(
            [
              {
                id: p.id,
                amountPaise: e.amount_paise,
                dueDate: d,
                status: 'UNPAID',
                recurrenceRule: e.recurrence_rule,
              },
            ],
            p.occurrence,
            p.occurrence,
          ).length,
        'Choose an unpaid scheduled occurrence.',
      );
      await c.query(
        'INSERT INTO bill_payments(expense_id,occurrence,paid_date) VALUES($1,$2,$3)',
        [p.id, p.occurrence, p.paidDate],
      );
      if (!e.recurrence_rule)
        await c.query(
          "UPDATE expenses SET paid_date=$3,status='PAID',updated_at=now() WHERE business_id=$1 AND id=$2",
          [b, p.id, p.paidDate],
        );
      await log(c, b, u, 'Bill paid', 'expense', p.id, null, {
        occurrence: p.occurrence,
        date: p.paidDate,
        amount: e.amount_paise,
      });
      return {};
    }
    if (kind === 'promise') {
      const p = z
          .object({
            id: uuid,
            amount: positive,
            date: day,
            source: notes.refine((s) => s.length > 0),
            proposed: notes,
            confirmed: z.literal('on'),
          })
          .parse(raw),
        i = await owned(c, b, 'invoices', p.id);
      const paid = await totalPaid(c, b, i.id);
      ensure(
        i.status !== 'DRAFT' && p.amount <= i.total_paise - paid,
        'Promise must fit the outstanding amount.',
      );
      await c.query(
        'UPDATE payment_promises SET superseded_at=now() WHERE business_id=$1 AND invoice_id=$2 AND superseded_at IS NULL',
        [b, i.id],
      );
      await c.query(
        "INSERT INTO payment_promises(business_id,invoice_id,promised_amount_paise,promised_date,source_note,confirmation_status,paid_at_confirmation) VALUES($1,$2,$3,$4,$5,'CONFIRMED',$6)",
        [b, i.id, p.amount, p.date, p.source, paid],
      );
      await log(
        c,
        b,
        u,
        'Payment promise confirmed',
        'invoice',
        i.id,
        { source: p.source, proposal: p.proposed },
        { amount: p.amount, date: p.date },
      );
      return {};
    }
    if (kind === 'note.reject') {
      const p = z
        .object({
          id: uuid,
          source: title.or(notes.refine(Boolean)),
          proposed: notes,
        })
        .parse(raw);
      await owned(c, b, 'invoices', p.id);
      await log(c, b, u, 'Note proposal rejected', 'invoice', p.id, {
        source: p.source,
        proposal: p.proposed,
      });
      return {};
    }
    if (kind === 'reminder') {
      const p = z
        .object({
          id: uuid,
          draft: z.union([uuid, z.literal('')]).default(''),
          content: notes.refine((s) => s.length > 0),
          status: z.enum(['DRAFT', 'MANUALLY_SENT']),
        })
        .parse(raw);
      const i = await owned(c, b, 'invoices', p.id);
      ensure(i.status !== 'DRAFT', 'Issue this invoice first.');
      if (p.draft) {
        const r = await owned(c, b, 'reminder_drafts', p.draft);
        ensure(r.invoice_id === p.id, 'Invalid draft.');
        await c.query(
          'UPDATE reminder_drafts SET content=$3,approval_status=$4 WHERE business_id=$1 AND id=$2',
          [b, p.draft, p.content, p.status],
        );
      } else
        await c.query(
          "INSERT INTO reminder_drafts(business_id,invoice_id,channel,content,approval_status) VALUES($1,$2,'MANUAL',$3,$4)",
          [b, p.id, p.content, p.status],
        );
      await log(
        c,
        b,
        u,
        p.status === 'DRAFT'
          ? 'Reminder draft saved'
          : 'Reminder marked manually sent',
        'invoice',
        p.id,
      );
      return {};
    }
    if (kind === 'scenario') {
      const p = scenarioFields.extend({ name: title }).parse(raw);
      if (p.invoiceId) await owned(c, b, 'invoices', p.invoiceId);
      if (p.expenseId) {
        await owned(c, b, 'expenses', p.expenseId);
        rupees.parse(p.expenseAmount);
      }
      await c.query(
        'INSERT INTO scenarios(business_id,name,assumptions_json) VALUES($1,$2,$3)',
        [b, p.name, JSON.stringify(p)],
      );
      return {};
    }
    if (kind === 'alert') {
      const p = z
        .object({
          key: z.string().min(1).max(300),
          status: z.enum(['DISMISSED', 'RESOLVED', 'OPEN']),
        })
        .parse(raw);
      await c.query(
        'DELETE FROM alerts WHERE business_id=$1 AND related_entity=$2',
        [b, p.key],
      );
      if (p.status !== 'OPEN')
        await c.query(
          "INSERT INTO alerts(business_id,type,severity,related_entity,status,explanation) VALUES($1,'DISPOSITION','info',$2,$3,'Owner reviewed the alert')",
          [b, p.key, p.status],
        );
      return {};
    }
    throw new StudioError('Unknown operation.', 404);
  });
}
