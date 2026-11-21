import Image from 'next/image';
import { notFound } from 'next/navigation';
import { workspace } from '@/lib/studio/data';
import { invoiceBalances } from '@/lib/finance/forecast';
import { dayLabel, money } from '@/lib/studio/format';
import { InvoiceForm } from '../InvoiceForm';
import {
  Hidden,
  PrintInvoice,
  StudioForm,
} from '@/components/forms/StudioForm';
import { Heading, Panel, RecordRow } from '@/components/studio/Ui';
import {
  Receive,
  Reminder,
  PromiseNote,
} from '@/components/studio/ReceivableTools';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await workspace(),
    { id } = await params,
    i = invoiceBalances(s).find((i) => i.id === id);
  if (!i) notFound();
  const items = s.items.filter((x) => x.invoiceId === id),
    ms = s.milestones.filter((x) => x.invoiceId === id),
    ps = s.payments.filter((p) => p.invoiceId === id),
    project = s.projects.find((p) => p.id === i.projectId);
  return (
    <>
      <div className="printable">
        {s.profile.logo && (
          <Image
            src={s.profile.logo}
            alt={s.profile.name + ' logo'}
            width={60}
            height={60}
            unoptimized
          />
        )}
        <Heading
          title={i.invoiceNumber}
          sub={s.profile.name + (s.profile.isDemo ? ' · Demo workspace' : '')}
        >
          <PrintInvoice />
        </Heading>
        <Panel title={i.client}>
          <span className="status">
            {i.status.replaceAll('_', ' ').toLowerCase()}
            {i.disputed ? ' · disputed' : ''}
          </span>
          <p>
            Issued {dayLabel(i.issueDate, true)} · Due{' '}
            {dayLabel(i.dueDate, true)} {project ? ' · ' + project.name : ''}
          </p>
          {items.map((x) => (
            <RecordRow
              key={x.id}
              name={x.description}
              meta={
                Number(x.quantity) +
                ' × ' +
                money(x.unitPricePaise) +
                (x.taxRateBp ? ' · ' + x.taxRateBp / 100 + '% tax' : '')
              }
              value={money(x.lineTotalPaise)}
            />
          ))}
          <RecordRow
            name="Subtotal"
            meta="Before tax"
            value={money(i.subtotalPaise)}
          />
          <RecordRow
            name="Tax"
            meta="Configured per line"
            value={money(i.taxAmountPaise)}
          />
          <RecordRow
            name="Invoice total"
            meta="INR"
            value={money(i.totalPaise)}
          />
          <RecordRow
            name="Recorded payments"
            meta="Excludes reversals"
            value={money(i.paid)}
          />
          <RecordRow
            name="Outstanding balance"
            meta={dayLabel(i.dueDate, true)}
            value={money(i.outstanding)}
          />
        </Panel>
      </div>
      <div className="noprint">
        {i.status === 'DRAFT' ? (
          <>
            <Panel title="Issue this draft">
              <StudioForm
                action="issue"
                label="Issue invoice"
                confirm="Issue this invoice and lock the line items and total?"
              >
                <Hidden name="id" value={id} />
              </StudioForm>
            </Panel>
            <Panel title="Edit draft">
              <InvoiceForm
                clients={s.clients.filter((c) => !c.archivedAt)}
                today={s.asOf}
                draft={{
                  id,
                  number: i.invoiceNumber,
                  clientId: i.clientId,
                  issue: i.issueDate,
                  due: i.dueDate,
                  project: project?.name || '',
                  lines: items.map((x) => ({
                    description: x.description,
                    quantity: String(Number(x.quantity)),
                    unitPrice: String(x.unitPricePaise / 100),
                    taxRate: x.taxRateBp ? String(x.taxRateBp / 100) : '',
                  })),
                  milestones: ms.map((m) => ({
                    name: m.name,
                    amount: String(m.expectedAmountPaise / 100),
                    due: m.dueDate,
                    expected: m.expectedPaymentDate || '',
                  })),
                }}
              />
            </Panel>
          </>
        ) : (
          <>
            {i.outstanding > 0 && (
              <Panel title="Record received payment">
                <Receive
                  id={id}
                  today={s.asOf}
                  issue={i.issueDate}
                  left={i.outstanding}
                />
              </Panel>
            )}
            <Panel title="Payment history">
              {ps.map((p) => (
                <div key={p.id}>
                  <RecordRow
                    name={p.method + (p.reversedAt ? ' · reversed' : '')}
                    meta={
                      dayLabel(p.receivedDate) +
                      ' · ' +
                      (p.reference || 'Owner recorded')
                    }
                    value={money(p.amountPaise)}
                  />
                  {!p.reversedAt && (
                    <details>
                      <summary>Reverse payment</summary>
                      <StudioForm action="reverse" label="Confirm reversal">
                        <Hidden name="id" value={p.id} />
                        <label>
                          Reason
                          <input name="reason" required />
                        </label>
                        <label className="check">
                          <input name="confirmed" type="checkbox" required />
                          Reverse this recorded payment
                        </label>
                      </StudioForm>
                    </details>
                  )}
                </div>
              ))}
              {!ps.length && <p>No payments recorded.</p>}
            </Panel>
            {i.outstanding > 0 && (
              <>
                <Panel title="Payment reminder" id="reminder">
                  <Reminder
                    id={id}
                    number={i.invoiceNumber}
                    client={i.client}
                    due={i.dueDate}
                    left={i.outstanding}
                    studio={s.profile.name}
                    existing={s.reminders
                      .filter((r) => r.invoiceId === id)
                      .at(-1)}
                  />
                </Panel>
                <Panel title="Payment promise" id="promise">
                  {s.promises
                    .filter((p) => p.invoiceId === id)
                    .map((p) => (
                      <RecordRow
                        key={p.id}
                        name={
                          (p.supersededAt ? 'Superseded' : 'Confirmed') +
                          ' · ' +
                          dayLabel(p.promisedDate)
                        }
                        meta={p.sourceNote || ''}
                        value={money(p.promisedAmountPaise)}
                      />
                    ))}
                  <PromiseNote
                    id={id}
                    client={i.client}
                    number={i.invoiceNumber}
                  />
                </Panel>
                <Panel title="Dispute review">
                  <StudioForm
                    action="dispute"
                    label={i.disputed ? 'Resolve dispute' : 'Mark as disputed'}
                  >
                    <Hidden name="id" value={id} />
                  </StudioForm>
                </Panel>
              </>
            )}
          </>
        )}
        {ms.length > 0 && (
          <Panel title="Payment milestones">
            {ms.map((m) => (
              <RecordRow
                key={m.id}
                name={m.name}
                meta={
                  'Due ' +
                  dayLabel(m.dueDate) +
                  (m.expectedPaymentDate
                    ? ' · expected ' + dayLabel(m.expectedPaymentDate)
                    : '')
                }
                value={money(m.expectedAmountPaise)}
              />
            ))}
          </Panel>
        )}
      </div>
    </>
  );
}
