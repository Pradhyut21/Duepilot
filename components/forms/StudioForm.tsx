'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
export function StudioForm({
  action,
  children,
  label,
  go,
  after,
  className = 'formgrid',
  confirm,
}: {
  action: string;
  children?: ReactNode;
  label: string;
  go?: string;
  after?: () => void;
  className?: string;
  confirm?: string;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || (confirm && !window.confirm(confirm))) return;
    setBusy(true);
    setMessage('');
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const res = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'Unable to save.');
      setError(false);
      setMessage('Saved.');
      if (go) router.push(go);
      router.refresh();
      after?.();
    } catch (err) {
      setError(true);
      setMessage(
        err instanceof Error
          ? err.message
          : 'Connection interrupted. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={className}>
      <fieldset disabled={busy} className="contents">
        {children}
        <button className="button" type="submit" disabled={busy}>
          {busy ? 'Saving…' : label}
        </button>
      </fieldset>
      {message && (
        <small
          role={error ? 'alert' : 'status'}
          className={error ? 'error' : 'success'}
        >
          {message}
        </small>
      )}
    </form>
  );
}
export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}
export function PrintInvoice() {
  return (
    <button className="button secondary" onClick={() => window.print()}>
      Print / save PDF
    </button>
  );
}
