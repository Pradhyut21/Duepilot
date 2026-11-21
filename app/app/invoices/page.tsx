import Link from 'next/link';
import { workspace } from '@/lib/studio/data';
import { invoiceBalances } from '@/lib/finance/forecast';
import { Heading, Panel, Quiet } from '@/components/studio/Ui';
import { dayLabel, money } from '@/lib/studio/format';
import { InvoiceForm } from './InvoiceForm';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const s = await workspace(),
    p = await searchParams;
  const rows = invoiceBalances(s).filter(
    (i) =>
      (!p.status ||
        i.status === p.status ||
        (p.status === 'OVERDUE' &&
          i.dueDate < s.asOf &&
          i.status !== 'DRAFT' &&
          i.outstanding > 0)) &&
      [i.invoiceNumber, i.client]
        .join(' ')
        .toLowerCase()
        .includes((p.q || '').toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Invoices"
        sub="Issue itemised invoices and track the balance on each one."
      />
      <Panel title="Invoice register">
        <form className="filters">
          <label>
            Search
            <input
              name="q"
              defaultValue={p.q}
              placeholder="Invoice or client"
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={p.status}>
              <option value="">All statuses</option>
              {['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map(
                (v) => (
                  <option key={v} value={v}>
                    {v.replace('_', ' ').toLowerCase()}
                  </option>
                ),
              )}
            </select>
          </label>
          <button className="button secondary">Filter</button>
        </form>
        {rows.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'Invoice',
                    'Client',
                    'Due date',
                    'Status',
                    'Outstanding',
                  ].map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={'/app/invoices/' + i.id}>
                        {i.invoiceNumber}
                      </Link>
                    </td>
                    <td>{i.client}</td>
                    <td>{dayLabel(i.dueDate)}</td>
                    <td>
                      {i.status.replace('_', ' ').toLowerCase()}
                      {i.disputed ? ' · disputed' : ''}
                    </td>
                    <td>{money(i.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Quiet>No invoices match this view.</Quiet>
        )}
      </Panel>
      <Panel title="Create an invoice" id="new">
        {s.clients.some((c) => !c.archivedAt) ? (
          <InvoiceForm
            clients={s.clients.filter((c) => !c.archivedAt)}
            today={s.asOf}
          />
        ) : (
          <Link href="/app/clients">Add your first client</Link>
        )}
      </Panel>
    </>
  );
}
