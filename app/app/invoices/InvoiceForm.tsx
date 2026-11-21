'use client';
import { useState, useActionState, useEffect } from 'react';
import { createInvoice, type InvoiceFormState } from './actions';
import { SubmitButton } from '@/components/auth/SubmitButton';
export type InvoiceClientOption = { id: string; name: string };
type Line = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};
type Installment = {
  name: string;
  amount: string;
  due: string;
  expected: string;
};
type Draft = {
  id: string;
  clientId: string;
  number: string;
  issue: string;
  due: string;
  project: string;
  lines: Line[];
  milestones: Installment[];
};
export function InvoiceForm({
  clients,
  today,
  draft,
}: {
  clients: InvoiceClientOption[];
  today?: string;
  draft?: Draft;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [state, act] = useActionState(
    async (previous: InvoiceFormState, fields: FormData) => {
      const result = await createInvoice(previous, fields);
      if (result.savedInvoiceId) {
        if (draft) window.location.reload();
        else window.location.assign('/app/invoices/' + result.savedInvoiceId);
      }
      return result;
    },
    {},
  );
  const [lines, setLines] = useState(
      draft?.lines ?? [
        { description: '', quantity: '1', unitPrice: '', taxRate: '' },
      ],
    ),
    [milestones, setMilestones] = useState<Installment[]>(
      draft?.milestones ?? [],
    );
  return (
    <form action={act} className="formgrid">
      <fieldset disabled={!ready} className="contents">
        <p role="alert" className="error">
          {state.formError || Object.values(state.fieldErrors ?? {}).join(' ')}
        </p>
        <input type="hidden" name="id" value={draft?.id ?? ''} />
        <label>
          Client
          <select name="clientId" required defaultValue={draft?.clientId ?? ''}>
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="pair">
          <label>
            Invoice number
            <input
              name="number"
              defaultValue={draft?.number}
              placeholder="Assigned on save"
              maxLength={80}
            />
          </label>
          <label>
            Project (optional)
            <input name="project" defaultValue={draft?.project} maxLength={120} />
          </label>
        </div>
        <div className="pair">
          <label>
            Issue date
            <input
              type="date"
              name="issue"
              defaultValue={draft?.issue ?? today}
              required
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              name="dueDate"
              defaultValue={draft?.due}
              required
            />
          </label>
        </div>
        {lines.map((line, i) => (
          <fieldset key={i} className="inset">
            <legend>Line item {i + 1}</legend>
            <div className="pair">
              {(['description', 'quantity', 'unitPrice', 'taxRate'] as const).map(
                (key, j) => (
                  <label key={key}>
                    {
                      ['Description', 'Quantity', 'Unit price (₹)', 'Tax rate %'][
                        j
                      ]
                    }
                    <input
                      name={'items.' + i + '.' + key}
                      required={key !== 'taxRate'}
                      value={line[key]}
                      onChange={(e) =>
                        setLines(
                          lines.map((v, k) =>
                            k === i ? { ...v, [key]: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                ),
              )}
            </div>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => setLines(lines.filter((_, k) => k !== i))}
              >
                Remove line
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          className="textbtn"
          onClick={() =>
            setLines([
              ...lines,
              { description: '', quantity: '1', unitPrice: '', taxRate: '' },
            ])
          }
        >
          + Add line item
        </button>
        {milestones.map((m, i) => (
          <fieldset className="inset" key={i}>
            <legend>Milestone {i + 1}</legend>
            <div className="pair">
              {(['name', 'amount', 'due', 'expected'] as const).map((k, j) => (
                <label key={k}>
                  {
                    [
                      'Milestone name',
                      'Amount (₹)',
                      'Milestone due',
                      'Confirmed expected date (optional)',
                    ][j]
                  }
                  <input
                    type={j > 1 ? 'date' : 'text'}
                    required={k !== 'expected'}
                    value={m[k]}
                    onChange={(e) =>
                      setMilestones(
                        milestones.map((v, n) =>
                          n === i ? { ...v, [k]: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMilestones(milestones.filter((_, n) => n !== i))}
            >
              Remove milestone
            </button>
          </fieldset>
        ))}
        <input
          type="hidden"
          name="milestones"
          value={JSON.stringify(milestones)}
        />
        <button
          type="button"
          className="textbtn"
          onClick={() =>
            setMilestones([
              ...milestones,
              { name: '', amount: '', due: '', expected: '' },
            ])
          }
        >
          + Add payment milestone
        </button>
        <SubmitButton pendingText="Saving…">Save draft</SubmitButton>
      </fieldset>
    </form>
  );
}
