'use client';

import { useActionState } from 'react';
import { createInvoice, type InvoiceFormState } from './actions';
import { Input } from '../../../components/ui/Input';
import { FormError } from '../../../components/ui/FormError';
import { SubmitButton } from '../../../components/auth/SubmitButton';

const initialState: InvoiceFormState = {};

export type InvoiceClientOption = { id: string; name: string };

/** Create-invoice form with one line item. Errors and entered values come back from createInvoice. */
export function InvoiceForm({ clients }: { clients: InvoiceClientOption[] }) {
  const [state, formAction] = useActionState(createInvoice, initialState);
  const clientError = state.fieldErrors?.clientId;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.formError} />

      <div className="space-y-1">
        <label htmlFor="invoice-client" className="block text-sm font-medium text-ink">
          Client
        </label>
        <select
          id="invoice-client"
          name="clientId"
          required
          defaultValue={state.values?.clientId ?? ''}
          aria-invalid={clientError ? true : undefined}
          className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink ${
            clientError ? 'border-negative' : 'border-slate-300'
          }`}
        >
          <option value="" disabled>
            Choose a client
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {clientError ? <p className="text-sm text-negative">{clientError}</p> : null}
      </div>

      <Input
        id="invoice-due-date"
        name="dueDate"
        type="date"
        label="Due date"
        required
        defaultValue={state.values?.dueDate}
        error={state.fieldErrors?.dueDate}
      />

      <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-ink">First line item</legend>

        <Input
          id="invoice-item-description"
          name="items.0.description"
          label="Description"
          required
          maxLength={500}
          defaultValue={state.values?.description}
        />

        <Input
          id="invoice-item-quantity"
          name="items.0.quantity"
          inputMode="decimal"
          label="Quantity"
          required
          maxLength={16}
          defaultValue={state.values?.quantity ?? '1'}
        />

        <Input
          id="invoice-item-unit-price"
          name="items.0.unitPrice"
          inputMode="decimal"
          label="Unit price (₹)"
          required
          maxLength={16}
          defaultValue={state.values?.unitPrice}
        />

        <Input
          id="invoice-item-tax-rate"
          name="items.0.taxRate"
          inputMode="decimal"
          label="Tax rate % (optional)"
          maxLength={6}
          defaultValue={state.values?.taxRate}
        />
      </fieldset>

      <SubmitButton pendingText="Saving…">Save invoice</SubmitButton>
    </form>
  );
}
