import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const day = (offset: number) => {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
test('private account, ledger, forecast, reminder, persistence and sign-in', async ({
  page,
  context,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = 'qa-' + randomUUID() + '@example.invalid',
    password = randomUUID() + 'Aa1';
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL,
  });
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('QA Studio Owner');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Business name').fill('Verification Studio');
  await page.getByLabel('Opening cash').fill('5000');
  await page.getByRole('button', { name: 'Open dashboard' }).click();
  await expect(
    page.getByRole('heading', { name: 'Studio overview' }),
  ).toBeVisible();
  await page.goto('/app/clients');
  await page.getByLabel('Name', { exact: true }).fill('QA Photography Client');
  await page.getByRole('button', { name: 'Save client' }).click();
  await expect(
    page.getByText('QA Photography Client', { exact: true }),
  ).toBeVisible();
  await page.goto('/app/invoices');
  await page
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: 'QA Photography Client' });
  await page.getByLabel('Due date', { exact: true }).fill(day(7));
  await page
    .getByLabel('Description', { exact: true })
    .fill('Wedding coverage');
  await page.getByLabel('Unit price').fill('1200.50');
  await page.getByRole('button', { name: 'Save draft' }).click();
  const issue = page.getByRole('button', {
    name: 'Issue invoice',
    exact: true,
  });
  await expect(issue).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await issue.click();
  await expect(
    page.getByRole('heading', { name: 'Record received payment' }),
  ).toBeVisible();
  const invoiceUrl = page.url();
  await page.getByLabel('Received amount').fill('200.25');
  await page.getByLabel('Payment method').fill('Cash');
  await page.getByLabel('I confirm the studio received').check();
  await page.getByRole('button', { name: 'Record confirmed payment' }).click();
  await expect(
    page.getByText('Outstanding balance', { exact: true }).locator('../..'),
  ).toContainText('₹1,000.25');
  await page.reload();
  await expect(
    page.getByText('Outstanding balance', { exact: true }).locator('../..'),
  ).toContainText('₹1,000.25');
  const reminder = page.getByLabel('Reminder text');
  await expect(reminder).toHaveValue(/1,000.25/);
  await reminder.fill(
    'Follow-up on INV-0001 for ₹1,000.25. Please confirm your date.',
  );
  await page.getByRole('button', { name: 'Save reminder' }).click();
  await expect(page.locator('#reminder').getByText('Saved.', {exact:true})).toHaveText(
    'Saved.',
  );
  await page.getByRole('button', { name: 'Copy reminder' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '₹1,000.25',
  );
  await page.goto('/app/expenses');
  await page.getByLabel('Description', { exact: true }).fill('Lens hire');
  await page.getByLabel('Category', { exact: true }).fill('Equipment rental');
  await page.getByLabel('Amount (₹)', { exact: true }).fill('6000');
  await page.getByLabel('Due date').fill(day(3));
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Lens hire', { exact: true })).toBeVisible();
  await page.goto('/app/forecast');
  await expect(page.getByText(/First shortfall on/)).toContainText('799.75');
  await page.goto('/app/scenarios');
  await page.getByRole('button', { name: 'Delay by 15 days' }).click();
  await expect(page.getByLabel('Payment delay (days)')).toHaveValue('15');
  await page.getByLabel('Scenario name').fill('Late receipt');
  await page.getByRole('button', { name: 'Save named scenario' }).click();
  await expect(
    page.getByRole('button', { name: 'Late receipt' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto(invoiceUrl);
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Studio overview' }),
  ).toBeVisible();
  await page.goto(invoiceUrl);
  await expect(
    page.getByText('Outstanding balance', { exact: true }).locator('../..'),
  ).toContainText('₹1,000.25');
  expect(errors).toEqual([]);
});
test('private sample reproduces nine negative days, resets, and fits supported widths', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Know your cash',
  );
  await page.getByRole('switch').click();
  await expect(page.getByText('First shortfall on 1 Dec.')).toBeVisible();
  await page.getByRole('button', { name: 'Explore live demo' }).click();
  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Studio overview' }),
  ).toBeVisible();
  const before = await (await page.request.get('/api/studio')).json();
  const selected = before.invoices.find(
    (i: { invoiceNumber: string }) => i.invoiceNumber === 'INV-0001',
  );
  await page.goto('/app/scenarios');
  await page.getByRole('button', { name: 'Delay by 15 days' }).click();
  const result = page
    .getByRole('heading', { name: 'Hypothetical scenario' })
    .locator('..')
    .locator('..');
  await expect(result).toContainText('-₹18,000');
  await expect(result).toContainText('1 Dec');
  await expect(result.getByText('9', { exact: true })).toBeVisible();
  const after = await (await page.request.get('/api/studio')).json();
  expect(after.invoices).toEqual(before.invoices);
  expect(after.payments).toEqual(before.payments);
  expect(after.promises).toEqual(before.promises);
  await page.getByRole('button', { name: 'Reset scenario' }).click();
  await expect(result).toContainText('₹17,000');
  await expect(result).toContainText('No shortfall');
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/',
      '/app',
      '/app/invoices',
      '/app/forecast',
      '/app/scenarios',
      '/app/actions',
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path + ' at ' + width,
      ).toBe(true);
    }
  }
  const unauth = await request.get('/api/studio');
  expect(unauth.status()).toBe(401);
  await page.goto('/app/invoices/' + selected.id);
  await expect(page.getByLabel('Reminder text')).toHaveValue(/35,000/);
  expect(errors).toEqual([]);
});
