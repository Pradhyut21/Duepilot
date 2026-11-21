import type { InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
}

/**
 * Labelled text input. The error message is linked with aria-describedby and
 * aria-invalid is set, so screen readers announce the problem with the field.
 */
export function Input({ id, label, error, className, ...rest }: InputProps) {
  const errorId = error ? `${id}-error` : undefined;
  const classes = [
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
    error ? 'border-negative' : 'border-slate-300',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={classes}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

