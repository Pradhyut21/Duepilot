import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { clients, invoices } from '../../../lib/db/schema';
import { SESSION_COOKIE_NAME, validateSession } from '../../../lib/auth/session';
import { scopeByBusiness } from '../../../lib/auth/tenant';
import { EmptyState } from '../../../components/ui/EmptyState';
import { InvoiceForm } from './InvoiceForm';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
};

const rupeeFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** Formats integer paise as a rupee amount, e.g. 123450 -> "₹1,234.50". */
function formatRupees(paise: number): string {
  return rupeeFormatter.format(paise / 100);
}

export default async function InvoicesPage() {
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
        <h1 className="text-2xl font-bold text-ink">Invoices</h1>
        <EmptyState
          title="No business linked"
          message="Your account is not linked to a business yet."
        />
      </section>
    );
  }

  const db = getDb();

  const [rows, clientOptions] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientName: clients.name,
        dueDate: invoices.dueDate,
        status: invoices.status,
        totalPaise: invoices.totalPaise,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(scopeByBusiness(invoices.businessId, businessId))
      .orderBy(desc(invoices.createdAt)),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(scopeByBusiness(clients.businessId, businessId), isNull(clients.archivedAt)))
      .orderBy(asc(clients.name)),
  ]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Invoices</h1>

      {rows.length === 0 ? (
        <EmptyState title="No invoices yet" message="Create your first invoice below." />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Number</th>
                <th scope="col" className="px-4 py-2 font-semibold">Client</th>
                <th scope="col" className="px-4 py-2 font-semibold">Due date</th>
                <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-ink">{row.invoiceNumber}</td>
                  <td className="px-4 py-3 text-ink">{row.clientName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.dueDate}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {STATUS_LABELS[row.status] ?? row.status}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{formatRupees(row.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-ink">Create an invoice</h2>
        {clientOptions.length === 0 ? (
          <EmptyState title="Add a client first" message="Invoices need a client. Add one on the Clients page." />
        ) : (
          <InvoiceForm clients={clientOptions} />
        )}
      </div>
    </section>
  );
}
