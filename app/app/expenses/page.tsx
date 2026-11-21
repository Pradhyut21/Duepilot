import { workspace } from '@/lib/studio/data';
import { forecast } from '@/lib/finance/forecast';
import { Heading, Panel, RecordRow, Quiet } from '@/components/studio/Ui';
import { money, dayLabel } from '@/lib/studio/format';
import { ExpenseForm } from './ExpenseForm';
import { StudioForm, Hidden } from '@/components/forms/StudioForm';
export default async function Page() {
  const s = await workspace(),
    f = forecast(s, 90);
  return (
    <>
      <Heading
        title="Bills & expenses"
        sub="Plan studio costs and record each paid occurrence."
      />
      <Panel title="Bill schedule">
        {s.expenses.map((e) => {
          const next = f.outflows.find((o) => o.expenseId === e.id);
          const occurrence =
            next?.occurrence ?? (e.dueDate > f.end ? e.dueDate : null);
          return (
            <article id={'bill-' + e.id} key={e.id}>
              <RecordRow
                name={e.description}
                meta={[
                  e.category,
                  e.recurrenceRule?.toLowerCase() || 'one-off',
                  e.status.toLowerCase(),
                  dayLabel(occurrence || e.dueDate),
                  s.projects.find((p) => p.id === e.projectId)?.name,
                  e.notes,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={money(e.amountPaise)}
              />
              {occurrence && (e.status !== 'PAID' || !!e.recurrenceRule) && (
                <details>
                  <summary>Record bill payment</summary>
                  <StudioForm action="bill.pay" label="Confirm bill payment">
                    <Hidden name="id" value={e.id} />
                    <Hidden name="occurrence" value={occurrence} />
                    <label>
                      Paid date
                      <input
                        type="date"
                        name="paidDate"
                        defaultValue={s.asOf}
                        max={s.asOf}
                        required
                      />
                    </label>
                    <label className="check">
                      <input name="confirmed" type="checkbox" required />
                      Paid {money(e.amountPaise)} for {dayLabel(occurrence)}
                    </label>
                  </StudioForm>
                </details>
              )}
            </article>
          );
        })}
        {!s.expenses.length && <Quiet>No scheduled bills yet.</Quiet>}
      </Panel>
      <Panel title="Add an expense">
        <ExpenseForm projects={s.projects} />
      </Panel>
    </>
  );
}
