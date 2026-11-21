import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { expenses } from '../../../lib/db/schema';
import { SESSION_COOKIE_NAME, validateSession } from '../../../lib/auth/session';
import { scopeByBusiness } from '../../../lib/auth/tenant';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ExpenseForm } from './ExpenseForm';

const RECURRENCE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
};

/** Formats integer paise as a rupee amount, e.g. 123450 -> "₹1,234.50". */
function formatRupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export default async function ExpensesPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect('/login');
  }

  const session = await validateSession(token);
  if (!session) {
    redirect('/login');
  }

  const businessId = session.business?.businessId;
  if (!businessId) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-ink">Expenses</h1>
        <EmptyState
          title="No business linked"
          message="Your account is not linked to a business yet."
        />
      </section>
    );
  }

  const rows = await getDb()
    .select({
      id: expenses.id,
      description: expenses.description,
      category: expenses.category,
      amountPaise: expenses.amountPaise,
      dueDate: expenses.dueDate,
      status: expenses.status,
      recurrenceRule: expenses.recurrenceRule,
    })
    .from(expenses)
    .where(scopeByBusiness(expenses.businessId, businessId))
    .orderBy(asc(expenses.dueDate), asc(expenses.id));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Expenses</h1>

      {rows.length === 0 ? (
        <EmptyState title="No expenses yet" message="Add your first expense below." />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Description</th>
                <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                <th scope="col" className="px-4 py-3 font-semibold">Due date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Recurrence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold text-ink">{row.description}</td>
                  <td className="px-4 py-3 text-slate-600">{row.category}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {formatRupees(row.amountPaise)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.dueDate}</td>
                  <td className="px-4 py-3 text-slate-600">{row.status}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.recurrenceRule
                      ? (RECURRENCE_LABELS[row.recurrenceRule] ?? row.recurrenceRule)
                      : 'One-off'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-ink">Add an expense</h2>
        <ExpenseForm />
      </div>
    </section>
  );
}
