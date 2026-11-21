'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h2>Studio records are unavailable</h2>
      <p>Check your connection, then reload the workspace.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
