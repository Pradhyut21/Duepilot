import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { SESSION_COOKIE_NAME, validateSession } from '@/lib/auth/session';
import { todayInTimezone } from '@/lib/records/invoice-dates';
export const DEMO_DATE = '2026-11-21';
export const sessionForRequest = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? await validateSession(token) : null;
});
export async function readStudio(b: string) {
  return getDb().transaction(
    async (tx) => {
      const [profile] = await tx
        .select()
        .from(t.businesses)
        .where(eq(t.businesses.id, b));
      if (!profile) throw new Error('Studio unavailable');
      const clients = await tx
          .select()
          .from(t.clients)
          .where(eq(t.clients.businessId, b))
          .orderBy(t.clients.name);
      const invoices = await tx
          .select()
          .from(t.invoices)
          .where(eq(t.invoices.businessId, b))
          .orderBy(t.invoices.dueDate, t.invoices.invoiceNumber);
      const items = await tx
          .select({ row: t.invoiceItems })
          .from(t.invoiceItems)
          .innerJoin(t.invoices, eq(t.invoices.id, t.invoiceItems.invoiceId))
          .where(eq(t.invoices.businessId, b));
      const milestones = await tx
          .select({ row: t.paymentMilestones })
          .from(t.paymentMilestones)
          .innerJoin(
            t.invoices,
            eq(t.invoices.id, t.paymentMilestones.invoiceId),
          )
          .where(eq(t.invoices.businessId, b))
          .orderBy(t.paymentMilestones.dueDate, t.paymentMilestones.id);
      const payments = await tx
          .select()
          .from(t.payments)
          .where(eq(t.payments.businessId, b))
          .orderBy(t.payments.receivedDate);
      const expenses = await tx
          .select()
          .from(t.expenses)
          .where(eq(t.expenses.businessId, b))
          .orderBy(t.expenses.dueDate, t.expenses.description);
      const billPayments = await tx
          .select({ row: t.billPayments })
          .from(t.billPayments)
          .innerJoin(t.expenses, eq(t.expenses.id, t.billPayments.expenseId))
          .where(eq(t.expenses.businessId, b));
      const promises = await tx
          .select()
          .from(t.paymentPromises)
          .where(eq(t.paymentPromises.businessId, b))
          .orderBy(t.paymentPromises.createdAt);
      const activities = await tx
          .select()
          .from(t.activities)
          .where(eq(t.activities.businessId, b))
          .orderBy(t.activities.createdAt);
      const scenarios = await tx
          .select()
          .from(t.scenarios)
          .where(eq(t.scenarios.businessId, b))
          .orderBy(t.scenarios.createdAt);
      const reminders = await tx
          .select()
          .from(t.reminderDrafts)
          .where(eq(t.reminderDrafts.businessId, b))
          .orderBy(t.reminderDrafts.createdAt);
      const alerts = await tx.select().from(t.alerts).where(eq(t.alerts.businessId, b));
      const projects = await tx.select().from(t.projects).where(eq(t.projects.businessId, b));
      return {
        profile,
        asOf: profile.isDemo ? DEMO_DATE : todayInTimezone('Asia/Kolkata'),
        clients,
        invoices,
        items: items.map((i) => i.row),
        milestones: milestones.map((i) => i.row),
        payments,
        expenses,
        billPayments: billPayments.map((i) => i.row),
        promises,
        activities,
        scenarios,
        reminders,
        alerts,
        projects,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export type Studio = Awaited<ReturnType<typeof readStudio>>;
export const workspace = cache(async () => {
  const s = await sessionForRequest();
  if (!s?.business) redirect('/login');
  return readStudio(s.business.businessId);
});
