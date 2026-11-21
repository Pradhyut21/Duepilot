import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold text-ink">DuePilot</h1>
      <p className="text-lg text-ink/80">Know your cash before your clients pay.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Start managing cash
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}

