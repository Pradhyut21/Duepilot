import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { workspace } from '@/lib/studio/data';
import { forecast } from '@/lib/finance/forecast';
import { money, dayLabel, dayDiff } from '@/lib/studio/format';
import {
  Heading,
  Panel,
  Metrics,
  RecordRow,
  Quiet,
} from '@/components/studio/Ui';
import { Chart } from '@/components/studio/Chart';
import { studioAlerts } from '@/lib/studio/alerts';
export default async function Dashboard() {
  const s = await workspace();
  if (!s.profile.openingBalanceDate) redirect('/onboarding');
  const f = forecast(s, s.profile.horizon),
    alerts = studioAlerts(s, f).filter((a) => a.status === 'OPEN');
  const upcoming = f.receipts
    .filter((r) => r.date)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  return (
    <>
      <Heading
        title="Studio overview"
        sub={'Cash position as of ' + dayLabel(s.asOf, true)}
      >
        <Link className="button" href="/app/invoices#new">
          <Plus size={17} />
          New invoice
        </Link>
      </Heading>
      <Metrics f={f} />
      <div className="dashgrid">
        <Panel title="Cash forecast" link={['/app/forecast', 'View forecast']}>
          <div className="charttop">
            <div>
              <span>Projected closing balance</span>
              <strong>{money(f.days.at(-1)!.closingBalancePaise)}</strong>
            </div>
            <b className="pill">{s.profile.horizon} days</b>
          </div>
          <Chart days={f.days} cash={f.cash} />
          <Link className="textbtn" href="/app/scenarios">
            Test a payment delay
          </Link>
        </Panel>
        <Panel title="Action centre" link={['/app/actions', 'View all']}>
          {alerts.slice(0, 3).map((a) => (
            <Link className="alertteaser" href={a.link} key={a.key}>
              <span className="status amber">{a.severity}</span>
              <strong>{a.title}</strong>
              <small>{a.explanation}</small>
            </Link>
          ))}
          {!alerts.length && <Quiet>No open alerts.</Quiet>}
        </Panel>
      </div>
      <div className="twocol">
        <Panel title="Expected receipts">
          {upcoming.map((r, i) => (
            <RecordRow
              key={i}
              name={r.client}
              meta={dayLabel(r.date!) + ' · ' + r.basis}
              value={money(r.amountPaise)}
              href={'/app/invoices/' + r.invoiceId}
            />
          ))}
          {!upcoming.length && <Quiet>No dated receipts yet.</Quiet>}
        </Panel>
        <Panel title="Upcoming bills" link={['/app/expenses', 'Manage bills']}>
          {f.outflows.slice(0, 5).map((o) => (
            <RecordRow
              key={o.expenseId + o.occurrence}
              name={o.description}
              meta={dayLabel(o.occurrence)}
              value={money(o.amountPaise)}
              href={'/app/expenses#bill-' + o.expenseId}
            />
          ))}
          {!f.outflows.length && <Quiet>No bills in this horizon.</Quiet>}
        </Panel>
      </div>
      <Panel title="Who owes you" link={['/app/invoices', 'All invoices']}>
        {[...f.invoices]
          .sort((a, b) => b.outstanding - a.outstanding)
          .map((i) => (
            <RecordRow
              key={i.id}
              name={i.client}
              meta={
                i.invoiceNumber +
                ' · due ' +
                dayLabel(i.dueDate) +
                (i.dueDate < s.asOf
                  ? ' · ' + dayDiff(i.dueDate, s.asOf) + ' days overdue'
                  : '')
              }
              value={money(i.outstanding)}
              href={'/app/invoices/' + i.id}
            />
          ))}
        {!f.invoices.length && <Quiet>No outstanding invoices.</Quiet>}
      </Panel>
      <Panel title="Financial activity">
        {s.activities
          .slice(-8)
          .reverse()
          .map((a) => (
            <RecordRow
              key={a.id}
              name={a.eventType}
              meta={a.createdAt.toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}
              href={
                a.entityType === 'invoice'
                  ? '/app/invoices/' + a.entityId
                  : undefined
              }
            />
          ))}
        {!s.activities.length && <Quiet>Recorded changes appear here.</Quiet>}
      </Panel>
    </>
  );
}
