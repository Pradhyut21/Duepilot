'use client';
import { useState } from 'react';
import Link from 'next/link';
import { forecast, type Forecast } from '@/lib/finance/forecast';
import type { Studio } from '@/lib/studio/data';
import { Chart } from '@/components/studio/Chart';
import { Panel, RecordRow } from '@/components/studio/Ui';
import { StudioForm, Hidden } from '@/components/forms/StudioForm';
import { money, dayLabel, shift } from '@/lib/studio/format';
import { parseRupeesToPaise } from '@/lib/money';
export function ScenarioLab({
  s,
  baseline,
}: {
  s: Studio;
  baseline: Forecast;
}) {
  const payable = baseline.invoices.filter((i) =>
      baseline.receipts.some((r) => r.invoiceId === i.id && r.date),
    ),
    defaultId =
      payable.find((i) => i.invoiceNumber === 'INV-0001')?.id ??
      payable[0]?.id ??
      '';
  const [invoice, setInvoice] = useState(defaultId),
    [delay, setDelay] = useState(0),
    [bill, setBill] = useState(''),
    [amount, setAmount] = useState('');
  let paise: number | undefined,
    invalid = false;
  if (bill) {
    try {
      paise = parseRupeesToPaise(amount);
    } catch {
      invalid = true;
    }
  }
  const f = forecast(s, s.profile.horizon, {
    invoiceId: invoice,
    days: delay,
    expenseId: bill,
    expensePaise: paise,
  });
  const affected = f.outflows.filter(
    (o) => f.days.find((d) => d.date === o.date)!.closingBalancePaise < 0,
  );
  const changed = baseline.receipts.filter(
    (r) => r.invoiceId === invoice && r.date,
  );
  function reset() {
    setInvoice(defaultId);
    setDelay(0);
    setBill('');
    setAmount('');
  }
  return (
    <>
      <Panel title="Scenario controls">
        <div className="formgrid">
          <div className="pair">
            <label>
              Expected payment
              <select
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
              >
                <option value="">No receipt delay</option>
                {payable.map((i) => (
                  <option value={i.id} key={i.id}>
                    {i.client} · {i.invoiceNumber}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Payment delay (days)
              <input
                type="number"
                aria-label="Payment delay (days)"
                min="0"
                max="365"
                value={delay}
                onChange={(e) =>
                  setDelay(
                    Math.max(
                      0,
                      Math.min(365, Math.trunc(Number(e.target.value))),
                    ),
                  )
                }
              />
            </label>
          </div>
          <div className="actions">
            <button
              disabled={!invoice}
              className="button secondary"
              onClick={() => setDelay(15)}
            >
              Delay by 15 days
            </button>
            <button className="textbtn" onClick={reset}>
              Reset scenario
            </button>
          </div>
          <div className="pair">
            <label>
              Hypothetical bill
              <select
                value={bill}
                onChange={(e) => {
                  setBill(e.target.value);
                  setAmount(
                    String(
                      (s.expenses.find((b) => b.id === e.target.value)
                        ?.amountPaise ?? 0) / 100,
                    ),
                  );
                }}
              >
                <option value="">Choose a bill (optional)</option>
                {s.expenses
                  .filter((e) =>
                    baseline.outflows.some((o) => o.expenseId === e.id),
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.description}
                    </option>
                  ))}
              </select>
            </label>
            {bill && (
              <label>
                Hypothetical amount (₹)
                <input
                  value={amount}
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
          </div>
        </div>
      </Panel>
      {invalid ? (
        <p role="alert">Enter a valid hypothetical bill amount.</p>
      ) : (
        <>
          <Panel title="Baseline and scenario">
            <Chart
              days={baseline.days}
              cash={baseline.cash}
              comparison={f.days}
            />
            {changed.map((r, i) => (
              <p key={i}>
                {r.client} · {money(r.amountPaise)} · {dayLabel(r.date!)}{' '}
                {delay
                  ? '→ ' + dayLabel(shift(r.date!, delay))
                  : '· original date'}
              </p>
            ))}
            {bill && (
              <p>
                Each unpaid occurrence of{' '}
                {s.expenses.find((e) => e.id === bill)?.description} uses{' '}
                {money(paise!)}.
              </p>
            )}
          </Panel>
          <div className="twocol">
            {[
              [baseline, 'Baseline'],
              [f, 'Hypothetical scenario'],
            ].map((_, i) => {
              const v = i ? f : baseline;
              return (
                <Panel key={i} title={i ? 'Hypothetical scenario' : 'Baseline'}>
                  <RecordRow
                    name="Lowest balance"
                    meta={dayLabel(v.lowest.date)}
                    value={money(v.lowest.closingBalancePaise)}
                  />
                  <RecordRow
                    name="Negative-cash days"
                    meta={
                      v.firstNegativeDate
                        ? 'First shortfall · ' + dayLabel(v.firstNegativeDate)
                        : 'No shortfall'
                    }
                    value={String(v.negativeDays)}
                  />
                </Panel>
              );
            })}
          </div>
          <Panel title="Affected obligations">
            {affected.length ? (
              <>
                {affected.map((o) => (
                  <RecordRow
                    key={o.expenseId + o.occurrence}
                    name={o.description}
                    meta={
                      'Projected cash on ' +
                      dayLabel(o.date) +
                      ' · ' +
                      money(
                        f.days.find((d) => d.date === o.date)!
                          .closingBalancePaise,
                      )
                    }
                    value={money(o.amountPaise)}
                  />
                ))}
                <p>
                  Review the expected receipt before the first shortfall and
                  discuss the timing of these bills.
                </p>
                {invoice && (
                  <Link
                    href={'/app/invoices/' + invoice + '#reminder'}
                    className="textbtn"
                  >
                    Prepare a client follow-up
                  </Link>
                )}
              </>
            ) : (
              <p>No scheduled bill falls on a negative closing-balance day.</p>
            )}
          </Panel>
          <Panel title="Save this scenario">
            <StudioForm action="scenario" label="Save named scenario">
              <label>
                Scenario name
                <input name="name" required maxLength={180} />
              </label>
              <Hidden name="invoiceId" value={invoice} />
              <Hidden name="days" value={String(delay)} />
              <Hidden name="expenseId" value={bill} />
              <Hidden name="expenseAmount" value={amount} />
            </StudioForm>
          </Panel>
        </>
      )}
      {s.scenarios.length > 0 && (
        <Panel title="Saved scenarios">
          {s.scenarios.map((v) => (
            <button
              className="button secondary"
              key={v.id}
              onClick={() => {
                const a = v.assumptionsJson;
                setInvoice(String(a.invoiceId || ''));
                setDelay(Number(a.days) || 0);
                setBill(String(a.expenseId || ''));
                setAmount(String(a.expenseAmount || ''));
              }}
            >
              {v.name}
            </button>
          ))}
        </Panel>
      )}
    </>
  );
}
