import { notFound } from 'next/navigation';
import { workspace } from '@/lib/studio/data';
import { invoiceBalances } from '@/lib/finance/forecast';
import { Heading, Panel, RecordRow } from '@/components/studio/Ui';
import { money, dayLabel } from '@/lib/studio/format';
import { StudioForm, Hidden } from '@/components/forms/StudioForm';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await workspace(),
    { id } = await params,
    c = s.clients.find((c) => c.id === id);
  if (!c) notFound();
  const inv = invoiceBalances(s).filter((i) => i.clientId === id),
    issued = inv.filter((i) => i.status !== 'DRAFT');
  return (
    <>
      <Heading
        title={c.name}
        sub={c.archivedAt ? 'Archived client' : 'Client account'}
      />
      <Panel title="Account summary">
        <RecordRow
          name="Total invoiced"
          meta="Issued invoices"
          value={money(issued.reduce((n, i) => n + i.totalPaise, 0))}
        />
        <RecordRow
          name="Paid"
          meta="Recorded receipts"
          value={money(issued.reduce((n, i) => n + i.paid, 0))}
        />
        <RecordRow
          name="Outstanding"
          meta="Unpaid balance"
          value={money(issued.reduce((n, i) => n + i.outstanding, 0))}
        />
      </Panel>
      <Panel title="Invoices">
        {inv.map((i) => (
          <RecordRow
            key={i.id}
            name={i.invoiceNumber}
            meta={i.status.toLowerCase()}
            value={money(i.totalPaise)}
            href={'/app/invoices/' + i.id}
          />
        ))}
        {!inv.length && <p>No invoices yet.</p>}
      </Panel>
      <Panel title="Payment history">
        {s.payments
          .filter((p) => inv.some((i) => i.id === p.invoiceId))
          .map((p) => (
            <RecordRow
              key={p.id}
              name={p.method + (p.reversedAt ? ' · reversed' : '')}
              meta={dayLabel(p.receivedDate)}
              value={money(p.amountPaise)}
            />
          ))}
      </Panel>
      <Panel title="Contact and notes">
        <StudioForm action="client.edit" label="Save client">
          <Hidden name="id" value={id} />
          <label>
            Name
            <input name="name" defaultValue={c.name} required />
          </label>
          <label>
            Email
            <input name="email" type="email" defaultValue={c.email || ''} />
          </label>
          <label>
            Phone
            <input name="phone" defaultValue={c.phone || ''} />
          </label>
          <label>
            Business notes
            <textarea name="notes" defaultValue={c.notes || ''} />
          </label>
        </StudioForm>
        <StudioForm
          action="client.archive"
          label={c.archivedAt ? 'Restore client' : 'Archive client'}
        >
          <Hidden name="id" value={id} />
        </StudioForm>
      </Panel>
    </>
  );
}
