'use client';

import { useActionState, useState } from 'react';
import { recordPayment, type PaymentFormState } from './actions';
import { Input } from '../../../components/ui/Input';
import { FormError } from '../../../components/ui/FormError';
import { SubmitButton } from '../../../components/auth/SubmitButton';

const initialState: PaymentFormState = {};

export type PaymentClientOption = {
  id: string;
  name: string;
  /** Preformatted payable outstanding for this client, e.g. "₹1,234.50". */
  outstandingLabel: string;
};

/** One submission key per form render, so a double-submit maps to the same payment. */
function createSubmissionKey(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure origins (e.g. plain http on a LAN address), where randomUUID is absent.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Record-payment form. Errors and entered values come back from recordPayment. */
export function PaymentForm({ clients }: { clients: PaymentClientOption[] }) {
  const [submissionKey, setSubmissionKey] = useState(createSubmissionKey);
  const [state, formAction] = useActionState(async (previous: PaymentFormState, fields: FormData) => {
    const result = await recordPayment(previous, fields);
    if (result.recorded) setSubmissionKey(createSubmissionKey());
    return result;
  }, initialState);
  const clientError = state.fieldErrors?.clientId;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <FormError message={state.formError} />
      {state.notice ? (
        <p className="text-sm text-slate-600">{state.notice}</p>
      ) : null}

      <div className="space-y-1">
        <label
          htmlFor="payment-client"
          className="block text-sm font-medium text-ink"
        >
          Client
        </label>
        <select
          id="payment-client"
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
              {`${client.name} (${client.outstandingLabel} awaiting payment)`}
            </option>
          ))}
        </select>
        {clientError ? (
          <p className="text-sm text-negative">{clientError}</p>
        ) : null}
      </div>

      <Input
        id="payment-amount"
        name="amount"
        inputMode="decimal"
        label="Amount (₹)"
        required
        maxLength={16}
        defaultValue={state.values?.amount}
        error={state.fieldErrors?.amount}
      />

      <Input
        id="payment-received-date"
        name="receivedDate"
        type="date"
        label="Received date"
        required
        defaultValue={state.values?.receivedDate}
        error={state.fieldErrors?.receivedDate}
      />

      <Input
        id="payment-method"
        name="method"
        label="Method"
        required
        maxLength={50}
        defaultValue={state.values?.method}
        error={state.fieldErrors?.method}
      />

      <Input
        id="payment-reference"
        name="reference"
        label="Reference (optional)"
        maxLength={200}
        defaultValue={state.values?.reference}
        error={state.fieldErrors?.reference}
      />

      <label className="check">
        <input type="checkbox" name="confirmed" required />I confirm receipt.
        Allocate this payment to the oldest due invoices first.
      </label>
      <SubmitButton pendingText="Saving…">Record payment</SubmitButton>
    </form>
  );
}
