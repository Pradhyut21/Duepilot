'use client';

import { useActionState } from 'react';
import { createClient, type ClientFormState } from './actions';
import { Input } from '../../../components/ui/Input';
import { FormError } from '../../../components/ui/FormError';
import { SubmitButton } from '../../../components/auth/SubmitButton';

const initialState: ClientFormState = {};

/** Create-client form. Errors and entered values come back from createClient. */
export function ClientForm() {
  const [state, formAction] = useActionState(
    async (previous: ClientFormState, fields: FormData) => {
      const result = await createClient(previous, fields);
      if (result.createdClientId) {
        window.location.assign('/app/clients/' + result.createdClientId);
      }
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.formError} />

      <Input
        id="client-name"
        name="name"
        label="Name"
        required
        maxLength={200}
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />

      <Input
        id="client-email"
        name="email"
        type="email"
        label="Email (optional)"
        maxLength={254}
        defaultValue={state.values?.email}
      />

      <Input
        id="client-phone"
        name="phone"
        type="tel"
        label="Phone (optional)"
        maxLength={32}
        defaultValue={state.values?.phone}
      />

      <Input
        id="client-notes"
        name="notes"
        label="Notes (optional)"
        maxLength={1000}
        defaultValue={state.values?.notes}
      />

      <SubmitButton pendingText="Saving…">Save client</SubmitButton>
    </form>
  );
}
