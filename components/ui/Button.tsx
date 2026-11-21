import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-indigo-700',
  secondary: 'border border-slate-300 bg-white text-ink hover:bg-slate-50',
};

/** Plain button. Defaults to type="button" so it never submits a form by accident. */
export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}

