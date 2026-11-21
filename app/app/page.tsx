import { EmptyState } from '../../components/ui/EmptyState';

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
      <EmptyState title="Nothing here yet" />
    </section>
  );
}

