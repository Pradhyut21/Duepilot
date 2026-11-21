import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('confirmed entries, source corrections, tenant isolation and demo reset through the API', async ({
  request,
  playwright,
  baseURL,
}) => {
  const headers = { Origin: baseURL!, Connection: 'close' };
  const post = (action: string, fields: object) =>
    request.post('/api/studio', { headers, data: { action, fields } });
  const read = async () => (await request.get('/api/studio')).json();
  expect((await request.post('/demo', { headers })).status()).toBe(200);
  const before = await read();
  const i = before.invoices.find(
    (x: { invoiceNumber: string }) => x.invoiceNumber === 'INV-0001',
  );
  const fields = {
    id: i.id,
    amount: '100',
    date: before.asOf,
    method: 'Manual entry',
    reference: 'QA',
    key: randomUUID(),
    confirmed: 'on',
  };
  expect(
    (
      await request.post('/api/studio', {
        maxRetries: 2,
        headers: { Origin: 'https://unrelated.example', Connection: 'close' },
        data: { action: 'payment', fields },
      })
    ).status(),
  ).toBe(403);
  expect((await post('payment', { ...fields, confirmed: '' })).status()).toBe(
    400,
  );
  expect((await post('payment', { ...fields, amount: '1.234' })).status()).toBe(
    400,
  );
  const other = await playwright.request.newContext({ baseURL });
  try {
    expect((await other.post('/demo', { headers })).ok()).toBeTruthy();
    expect(
      (
        await other.post('/api/studio', {
          headers,
          data: { action: 'payment', fields },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await other.dispose();
  }
  expect((await post('payment', fields)).ok()).toBeTruthy();
  expect((await post('payment', fields)).ok()).toBeTruthy();
  const after = await read();
  const payments = after.payments.filter(
    (p: { idempotencyKey: string }) => p.idempotencyKey === fields.key,
  );
  expect(payments).toHaveLength(1);
  expect(
    (
      await post('reverse', {
        id: payments[0].id,
        reason: 'QA reversal',
        confirmed: 'on',
      })
    ).ok(),
  ).toBeTruthy();
  const source = 'Arjun confirmed a revised date in writing.';
  expect(
    (
      await post('promise', {
        id: i.id,
        source,
        amount: '35000',
        date: '2026-12-12',
        proposed: 'Date unclear',
        confirmed: 'on',
      })
    ).ok(),
  ).toBeTruthy();
  const bill = before.expenses[0];
  expect(
    (
      await post('bill.pay', {
        id: bill.id,
        occurrence: bill.dueDate,
        paidDate: before.asOf,
        confirmed: 'on',
      })
    ).ok(),
  ).toBeTruthy();
  const changed = await read();
  expect(changed.billPayments).toHaveLength(1);
  expect(
    changed.promises.filter(
      (p: { supersededAt: string | null }) => !p.supersededAt,
    ),
  ).toHaveLength(1);
  expect(changed.promises.at(-1).sourceNote).toBe(source);
  expect(
    changed.activities.some(
      (a: { eventType: string }) => a.eventType === 'Payment reversed',
    ),
  ).toBe(true);
  expect((await post('demo.reset', {})).ok()).toBeTruthy();
  const reset = await read();
  expect(reset.billPayments).toHaveLength(0);
  expect(reset.payments).toHaveLength(before.payments.length);
  expect(reset.promises[0].promisedDate).toBe('2026-11-27');
});
