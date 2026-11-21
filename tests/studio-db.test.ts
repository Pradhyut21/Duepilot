import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDemo } from '../lib/studio/demo';
import { getPool } from '../lib/db/client';
import { readStudio } from '../lib/studio/data';
import { mutate } from '../lib/studio/mutations';
import { forecast } from '../lib/finance/forecast';
describe.skipIf(!process.env.DATABASE_URL)(
  'tenant ledger with PostgreSQL',
  () => {
    let u = '',
      b = '',
      id = '';
    beforeAll(async () => {
      u = await createDemo();
      b = (
        await getPool().query(
          'SELECT id FROM businesses WHERE owner_user_id=$1',
          [u],
        )
      ).rows[0].id;
      id = (await readStudio(b)).invoices.find(
        (i) => i.invoiceNumber === 'INV-0001',
      )!.id;
    }, 60000);
    afterAll(async () => {
      if (b)
        await getPool().query(
          'DELETE FROM businesses WHERE id=$1 AND owner_user_id=$2',
          [b, u],
        );
      if (u) await getPool().query('DELETE FROM users WHERE id=$1', [u]);
    }, 30000);
    it('refuses an unrelated user and record IDs', async () => {
      await expect(mutate(b, randomUUID(), 'issue', { id })).rejects.toThrow(
        'Studio unavailable',
      );
      await expect(mutate(b, u, 'issue', { id: randomUUID() })).rejects.toThrow(
        'Record not found',
      );
    }, 20000);
    it('serializes duplicate and excessive payments, reverses exactly once and records the audit', async () => {
      const key = randomUUID();
      const fields = {
        id,
        key,
        amount: '123.45',
        date: '2026-11-21',
        method: 'Owner entry',
        reference: 'test',
        confirmed: 'on',
      };
      await Promise.all([
        mutate(b, u, 'payment', fields),
        mutate(b, u, 'payment', fields),
      ]);
      const snap = await readStudio(b),
        p = snap.payments.find((p) => p.idempotencyKey === key)!;
      expect(
        snap.payments.filter((p) => p.idempotencyKey === key),
      ).toHaveLength(1);
      expect(forecast(snap, 30).cash).toBe(1812345);
      await expect(
        mutate(b, u, 'payment', {
          ...fields,
          key: randomUUID(),
          amount: '35000',
        }),
      ).rejects.toThrow('exceeds');
      await expect(
        mutate(b, u, 'payment', { ...fields, amount: '40' }),
      ).rejects.toThrow('key');
      await mutate(b, u, 'reverse', {
        id: p.id,
        reason: 'Entry correction',
        confirmed: 'on',
      });
      await expect(
        mutate(b, u, 'reverse', { id: p.id, reason: 'Again', confirmed: 'on' }),
      ).rejects.toThrow('Already reversed');
      const end = await readStudio(b);
      expect(forecast(end, 30).cash).toBe(1800000);
      expect(
        end.activities.some((a) => a.eventType === 'Payment reversed'),
      ).toBe(true);
    }, 60000);
    it('saves scenario assumptions without updating promises or invoices', async () => {
      const before = await readStudio(b);
      await mutate(b, u, 'scenario', {
        name: 'Delayed client',
        invoiceId: id,
        days: 15,
        expenseId: '',
        expenseAmount: '',
      });
      const after = await readStudio(b);
      expect(after.scenarios.at(-1)?.name).toBe('Delayed client');
      expect(after.promises).toEqual(before.promises);
      expect(after.invoices).toEqual(before.invoices);
    }, 20000);
  },
);
