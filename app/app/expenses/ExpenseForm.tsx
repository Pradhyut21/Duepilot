'use client';

import { useActionState } from 'react';
import { createExpense, type ExpenseFormState } from './actions';
import { Input } from '../../../components/ui/Input';
import { FormError } from '../../../components/ui/FormError';
import { SubmitButton } from '../../../components/auth/SubmitButton';

const initialState: ExpenseFormState = {};

/** Create-expense form. Errors and entered values come back from createExpense. */
export function ExpenseForm({
  projects = [],
}: {
  projects?: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    async (previous: ExpenseFormState, fields: FormData) => {
      const result = await createExpense(previous, fields);
      if (result.notice) window.location.reload();
      return result;
    },
    initialState,
  );
  const recurrenceError = state.fieldErrors?.recurrenceRule;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.formError} />
      {state.notice && <p role="status" className="success">{state.notice}</p>}

      <Input
        id="expense-description"
        name="description"
        label="Description"
        required
        maxLength={200}
        defaultValue={state.values?.description}
        error={state.fieldErrors?.description}
      />

      <Input
        id="expense-category"
        name="category"
        label="Category"
        required
        maxLength={100}
        defaultValue={state.values?.category}
        error={state.fieldErrors?.category}
      />

      <Input
        id="expense-amount"
        name="amount"
        inputMode="decimal"
        label="Amount (₹)"
        required
        maxLength={20}
        defaultValue={state.values?.amount}
        error={state.fieldErrors?.amount}
      />

      <Input
        id="expense-due-date"
        name="dueDate"
        type="date"
        label="Due date"
        required
        defaultValue={state.values?.dueDate}
        error={state.fieldErrors?.dueDate}
      />

      <div className="space-y-1">
        <label
          htmlFor="expense-recurrence"
          className="block text-sm font-medium text-ink"
        >
          Recurrence
        </label>
        <select
          id="expense-recurrence"
          name="recurrenceRule"
          defaultValue={state.values?.recurrenceRule ?? ''}
          aria-invalid={recurrenceError ? true : undefined}
          aria-describedby={
            recurrenceError ? 'expense-recurrence-error' : undefined
          }
          className={[
            'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            recurrenceError ? 'border-negative' : 'border-slate-300',
          ].join(' ')}
        >
          <option value="">One-off</option>
          <option value="MONTHLY">Monthly</option>
          <option value="WEEKLY">Weekly</option>
        </select>
        {recurrenceError ? (
          <p id="expense-recurrence-error" className="text-sm text-negative">
            {recurrenceError}
          </p>
        ) : null}
      </div>

      <label>
        Associated project
        <select name="projectId">
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notes
        <textarea name="notes" maxLength={2000} />
      </label>
      <SubmitButton pendingText="Saving…">Save expense</SubmitButton>
    </form>
  );
}
