import Link from 'next/link';
import { workspace } from '@/lib/studio/data';
import { forecast } from '@/lib/finance/forecast';
import { Chart } from '@/components/studio/Chart';
import { Heading, Panel, RecordRow } from '@/components/studio/Ui';
import { money, dayLabel } from '@/lib/studio/format';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const s = await workspace(),
    n = Number((await searchParams).days),
    h = [30, 60, 90].includes(n) ? n : s.profile.horizon,
    f = forecast(s, h);
  return (
    <>
      <Heading
        title="Cash forecast"
        sub="Projected daily closing cash, based on your studio records."
      >
        <Link href="/app/scenarios" className="button">
          Open Scenario Lab
        </Link>
      </Heading>
      <Panel title="Daily cash balance">
        <div className="seg">
          {[30, 60, 90].map((n) => (
            <Link
              aria-current={h === n ? 'page' : undefined}
              href={'?days=' + n}
              key={n}
            >
              {n} days
            </Link>
          ))}
        </div>
        <Chart days={f.days} cash={f.cash} />
        <p>
          Lowest projected balance <b>{money(f.lowest.closingBalancePaise)}</b>{' '}
          on {dayLabel(f.lowest.date)}.{' '}
          {f.firstNegativeDate
            ? 'First shortfall on ' + dayLabel(f.firstNegativeDate) + '.'
            : 'Cash stays above or at zero throughout this horizon.'}
        </p>
      </Panel>
      <div className="twocol">
        <Panel title="Recorded cash">
          <RecordRow
            name="Opening balance"
            meta={s.profile.openingBalanceDate ?? 'Opening date unset'}
            value={money(s.profile.openingBalancePaise)}
          />
          <RecordRow
            name="Payments received"
            meta="Since opening date, excluding reversals"
            value={money(f.actualIn)}
          />
          <RecordRow
            name="Bills paid"
            meta="Recorded cash outflows"
            value={money(f.actualOut)}
          />
          <RecordRow
            name="Available cash"
            meta={dayLabel(s.asOf)}
            value={money(f.cash)}
          />
        </Panel>
        <Panel title="Forecast completeness">
          <RecordRow
            name="Expected within horizon"
            meta="Dated, unpaid receipts"
            value={money(f.expected)}
          />
          <RecordRow
            name="Beyond horizon"
            meta="Dated after the last forecast day"
            value={money(f.beyond)}
          />
          <RecordRow
            name="Unforecasted"
            meta="Missing date, missed promise or disputed"
            value={money(f.unforecasted)}
          />
        </Panel>
      </div>
      <Panel title="Receipt assumptions">
        {f.receipts.map((r, i) => (
          <RecordRow
            key={i}
            name={r.client + ' · ' + r.number}
            meta={
              (r.date ? dayLabel(r.date) : 'Unforecasted') + ' · ' + r.basis
            }
            value={money(r.amountPaise)}
            href={'/app/invoices/' + r.invoiceId}
          />
        ))}
        {!f.receipts.length && <p>No outstanding receipts.</p>}
      </Panel>
      <Panel title="Daily ledger">
        <details>
          <summary>View {h} daily balances</summary>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  {['Date', 'Expected in', 'Bills out', 'Projected close'].map(
                    (k) => (
                      <th key={k}>{k}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {f.days.map((d) => (
                  <tr key={d.date}>
                    <td>{dayLabel(d.date)}</td>
                    <td>{money(d.inflowPaise)}</td>
                    <td>{money(d.outflowPaise)}</td>
                    <td>{money(d.closingBalancePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>
    </>
  );
}
