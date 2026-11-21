'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonVariant } from '../ui/Button';

export interface SubmitButtonProps {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
}

/** Submit button that disables itself while its parent form is pending. */
export function SubmitButton({
  children,
  pendingText = 'Working…',
  variant = 'primary',
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

