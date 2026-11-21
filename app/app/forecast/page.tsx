import { EmptyState } from '../../../components/ui/EmptyState';

export default function ForecastPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Forecast</h1>
      <EmptyState title="Nothing here yet" />
    </section>
  );
}

