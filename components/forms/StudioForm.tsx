'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const noticeKey = 'duepilot.savedPath';

export function SaveNotice() {
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      setSaved(sessionStorage.getItem(noticeKey) === pathname);
      sessionStorage.removeItem(noticeKey);
    } catch {
      setSaved(false);
    }
  }, [pathname]);
  return saved ? <p role="status" className="success mb-3 noprint">Changes saved.</p> : null;
}

export function StudioForm({ action, children, label, go, className = 'formgrid', confirm }: {
  action: string;
  children?: ReactNode;
  label: string;
  go?: string;
  className?: string;
  confirm?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || (confirm && !window.confirm(confirm))) return;
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/studio', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, fields }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Unable to save.');
      try {
        sessionStorage.setItem(noticeKey, go || window.location.pathname);
      } catch {
        // A disabled session store only affects the transient save notice.
      }
      // Fetch the committed record in a new document, including its dependent balances.
      if (go) window.location.assign(go);
      else window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection interrupted. Try again.');
      setBusy(false);
    }
  }
  return <form onSubmit={submit} className={className}>
    <fieldset disabled={busy} className="contents">
      {children}
      <button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : label}</button>
    </fieldset>
    {error && <small role="alert" className="error">{error}</small>}
  </form>;
}
export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}
export function PrintInvoice() {
  return <button className="button secondary" onClick={() => window.print()}>Print / save PDF</button>;
}
