import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, isNull } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { clients } from '../../../lib/db/schema';
import { SESSION_COOKIE_NAME, validateSession } from '../../../lib/auth/session';
import { scopeByBusiness } from '../../../lib/auth/tenant';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ClientForm } from './ClientForm';

export default async function ClientsPage() {
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
        <h1 className="text-2xl font-bold text-ink">Clients</h1>
        <EmptyState
          title="No business linked"
          message="Your account is not linked to a business yet."
        />
      </section>
    );
  }

  const rows = await getDb()
    .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone })
    .from(clients)
    .where(and(scopeByBusiness(clients.businessId, businessId), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Clients</h1>

      {rows.length === 0 ? (
        <EmptyState title="No clients yet" message="Add your first client below." />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
          {rows.map((row) => {
            const contact = [row.email, row.phone].filter(Boolean).join(' · ');
            return (
              <li key={row.id} className="px-4 py-3">
                <p className="font-semibold text-ink">{row.name}</p>
                {contact ? <p className="text-sm text-slate-600">{contact}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-ink">Add a client</h2>
        <ClientForm />
      </div>
    </section>
  );
}
