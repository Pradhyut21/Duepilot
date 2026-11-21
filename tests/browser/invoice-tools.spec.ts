import { test, expect } from '@playwright/test';
test('owner reviews note extraction, prints an invoice and revises an itemized draft', async ({
  page,
  baseURL,
}) => {
  await page.request.post('/demo', { headers: { Origin: baseURL! } });
  const get = async () => (await page.request.get('/api/studio')).json();
  const original = await get();
  const invoice = original.invoices.find(
    (i: { invoiceNumber: string }) => i.invoiceNumber === 'INV-0001',
  );
  await page.goto('/app/invoices/' + invoice.id);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5000);
  const source = 'Arjun said he would pay the remaining 35k next Friday.';
  await page.getByLabel('Original client note').fill(source);
  await page.getByRole('button', { name: 'Review proposed fields' }).click();
  await expect(page.getByLabel('Promised amount')).toHaveValue('35000');
  await expect(page.getByLabel('Promised date')).toHaveValue('');
  await page.getByLabel('Promised amount').fill('34000');
  await page.getByLabel('Promised date').fill('2026-12-10');
  await page.getByLabel('I confirm the client').check();
  await page.getByRole('button', { name: 'Confirm payment promise' }).click();
  await expect(
    page.locator('#promise').getByText('Confirmed · 10 Dec'),
  ).toBeVisible();
  const reviewed = await get();
  expect(reviewed.payments).toEqual(original.payments);
  expect(reviewed.promises.at(-1).sourceNote).toBe(source);
  await page.goto('/app/invoices');
  await page
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: 'Bhavna Shah' });
  await page.getByLabel('Invoice number').fill('QA-EDIT');
  await page.getByLabel('Due date', { exact: true }).fill('2026-12-01');
  await page.getByLabel('Description', { exact: true }).fill('Prints');
  await page.getByLabel('Unit price').fill('100.05');
  await page.getByLabel('Tax rate').fill('5');
  await page.getByRole('button', { name: 'Add line item' }).click();
  await page.getByLabel('Description', { exact: true }).nth(1).fill('Retouch');
  await page.getByLabel('Unit price').nth(1).fill('20');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: 'QA-EDIT' })).toBeVisible();
  await expect(
    page.getByText('Invoice total', { exact: true }).locator('../..'),
  ).toContainText('₹125.05');
  await page.getByLabel('Unit price').nth(1).fill('25');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByText('Invoice total', { exact: true }).locator('../..'),
  ).toContainText('₹130.05');
});
