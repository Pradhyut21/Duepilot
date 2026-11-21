'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, type AuthFormState } from '../actions';
import { Input } from '../../../components/ui/Input';
import { FormError } from '../../../components/ui/FormError';
import { SubmitButton } from '../../../components/auth/SubmitButton';

const initialState: AuthFormState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">Log in to DuePilot</h1>
          <p className="text-sm text-slate-600">Welcome back. Pick up where you left off.</p>
        </div>

        <form action={formAction} className="space-y-4" noValidate>
          <FormError message={state.formError} />

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
            label="Password"
            autoComplete="current-password"
            required
            maxLength={128}
            error={state.fieldErrors?.password}
          />

          <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
        </form>

        <p className="text-sm text-slate-600">
          New to DuePilot?{' '}
          <Link href="/signup" className="font-semibold text-accent underline">
            Start managing cash
          </Link>
        </p>
      </div>
    </main>
  );
}

