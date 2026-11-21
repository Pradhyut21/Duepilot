import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { clients, invoices, payments } from '../../../lib/db/schema';
import { SESSION_COOKIE_NAME, validateSession } from '../../../lib/auth/session';
import { scopeByBusiness } from '../../../lib/auth/tenant';
import {
  PAYABLE_INVOICE_STATUSES,
  sumPayableOutstanding,
} from '../../../lib/payments/rules';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PaymentForm, type PaymentClientOption } from './PaymentForm';

const RECENT_PAYMENTS_LIMIT = 50;

const rupeeFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** Formats integer paise as a rupee amount, e.g. 123450 -> "₹1,234.50". */
function formatRupees(paise: number): string {
  return rupeeFormatter.format(paise / 100);
}

export default async function PaymentsPage() {
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
        <h1 className="text-2xl font-bold text-ink">Payments</h1>
        <EmptyState
          title="No business linked"
          message="Your account is not linked to a business yet."
        />
      </section>
    );
  }

  const db = getDb();

  const [rows, clientOptions, payableInvoiceRows] = await Promise.all([
    db
      .select({
        id: payments.id,
        amountPaise: payments.amountPaise,
        receivedDate: payments.receivedDate,
        method: payments.method,
        reversedAt: payments.reversedAt,
        invoiceNumber: invoices.invoiceNumber,
        clientName: clients.name,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(scopeByBusiness(payments.businessId, businessId))
      .orderBy(desc(payments.receivedDate), desc(payments.createdAt))
      .limit(RECENT_PAYMENTS_LIMIT),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(scopeByBusiness(clients.businessId, businessId), isNull(clients.archivedAt)))
      .orderBy(asc(clients.name)),
    db
      .select({
        id: invoices.id,
        clientId: invoices.clientId,
        status: invoices.status,
        totalPaise: invoices.totalPaise,
      })
      .from(invoices)
      .where(
        and(
          scopeByBusiness(invoices.businessId, businessId),
          inArray(invoices.status, [...PAYABLE_INVOICE_STATUSES]),
        ),
      ),
  ]);

  const payableIds = payableInvoiceRows.map((row) => row.id);
  const paymentRows =
    payableIds.length === 0
      ? []
      : await db
          .select({ invoiceId: payments.invoiceId, amountPaise: payments.amountPaise })
          .from(payments)
          .where(
            and(
              scopeByBusiness(payments.businessId, businessId),
              inArray(payments.invoiceId, payableIds),
              isNull(payments.reversedAt),
            ),
          );

  const paidByInvoice = new Map<string, number>();
  for (const row of paymentRows) {
    paidByInvoice.set(row.invoiceId, (paidByInvoice.get(row.invoiceId) ?? 0) + row.amountPaise);
  }

  const invoicesByClient = new Map<string, typeof payableInvoiceRows>();
  for (const row of payableInvoiceRows) {
    const list = invoicesByClient.get(row.clientId) ?? [];
    list.push(row);
    invoicesByClient.set(row.clientId, list);
  }

  // Only clients with a positive payable outstanding balance can receive a payment.
  const payableClients: PaymentClientOption[] = [];
  for (const client of clientOptions) {
    const clientInvoices = invoicesByClient.get(client.id) ?? [];
    const { payableOutstandingPaise } = sumPayableOutstanding(
      clientInvoices.map((row) => ({
        id: row.id,
        status: row.status,
        totalPaise: row.totalPaise,
        paidPaise: paidByInvoice.get(row.id) ?? 0,
      })),
    );
    if (payableOutstandingPaise > 0) {
      payableClients.push({
        id: client.id,
        name: client.name,
        outstandingLabel: formatRupees(payableOutstandingPaise),
      });
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Payments</h1>

      {rows.length === 0 ? (
        <EmptyState title="No payments yet" message="Record your first payment below." />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Client</th>
                <th scope="col" className="px-4 py-2 font-semibold">Invoice</th>
                <th scope="col" className="px-4 py-2 font-semibold">Received</th>
                <th scope="col" className="px-4 py-2 font-semibold">Method</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-ink">{row.clientName}</td>
                  <td className="px-4 py-3 font-medium text-ink">{row.invoiceNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{row.receivedDate}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.method}
                    {row.reversedAt ? (
                      <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Reversed
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{formatRupees(row.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-ink">Record a payment</h2>
        {clientOptions.length === 0 ? (
          <EmptyState
            title="Add a client first"
            message="Payments are recorded against a client. Add one on the Clients page."
          />
        ) : payableClients.length === 0 ? (
          <EmptyState
            title="Nothing awaiting payment"
            message="This client has no invoices awaiting payment. Issue an invoice first."
          />
        ) : (
          <PaymentForm clients={payableClients} />
        )}
      </div>
    </section>
  );
}
