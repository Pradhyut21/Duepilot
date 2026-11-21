import { workspace } from '@/lib/studio/data';
import { invoiceBalances } from '@/lib/finance/forecast';
import { Heading, Panel, RecordRow, Quiet } from '@/components/studio/Ui';
import { money } from '@/lib/studio/format';
import { ClientForm } from './ClientForm';
export default async function Page() {
  const s = await workspace(),
    rows = invoiceBalances(s);
  return (
    <>
      <Heading
        title="Clients"
        sub="Contacts, payment history and studio notes."
      />
      <Panel title="Client directory">
        {s.clients.map((c) => (
          <RecordRow
            key={c.id}
            name={c.name + (c.archivedAt ? ' · archived' : '')}
            meta={c.email || 'View client account'}
            value={
              money(
                rows
                  .filter((i) => i.clientId === c.id && i.status !== 'DRAFT')
                  .reduce((n, i) => n + i.outstanding, 0),
              ) + ' due'
            }
            href={'/app/clients/' + c.id}
          />
        ))}
        {!s.clients.length && <Quiet>Add your first client below.</Quiet>}
      </Panel>
      <Panel title="Add a client">
        <ClientForm />
      </Panel>
    </>
  );
}
