'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signUpAction, type AuthFormState } from '../actions';
import { Input } from '../../../components/ui/Input';
import { FormError } from '../../../components/ui/FormError';
import { SubmitButton } from '../../../components/auth/SubmitButton';

const initialState: AuthFormState = {};

export default function SignUpPage() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">Create your DuePilot account</h1>
          <p className="text-sm text-slate-600">Start tracking what your clients owe you.</p>
        </div>

        <form action={formAction} className="space-y-4" noValidate>
          <FormError message={state.formError} />

          <Input
            id="displayName"
            name="displayName"
            label="Your name"
            autoComplete="name"
            required
            maxLength={80}
            defaultValue={state.values?.displayName}
            error={state.fieldErrors?.displayName}
          />

          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Password (at least 10 characters)"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            error={state.fieldErrors?.password}
          />

          <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
        </form>

        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-accent underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

