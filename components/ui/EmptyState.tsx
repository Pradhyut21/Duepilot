export interface EmptyStateProps {
  title: string;
  message?: string;
}

export function EmptyState({
  title,
  message = 'Coming in the next build phase.',
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </div>
  );
}

