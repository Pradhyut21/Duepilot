'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Files,
  Wallet,
  Banknote,
  ChartNoAxesCombined,
  SlidersHorizontal,
  ListChecks,
  Settings,
} from 'lucide-react';
const items = [
  ['/app', 'Overview', LayoutDashboard],
  ['/app/clients', 'Clients', Users],
  ['/app/invoices', 'Invoices', Files],
  ['/app/payments', 'Payments', Wallet],
  ['/app/expenses', 'Bills & expenses', Banknote],
  ['/app/forecast', 'Cash forecast', ChartNoAxesCombined],
  ['/app/scenarios', 'Scenario Lab', SlidersHorizontal],
  ['/app/actions', 'Action centre', ListChecks],
  ['/app/settings', 'Settings', Settings],
] as const;
export function AppNav({
  variant = 'sidebar',
}: {
  variant?: 'sidebar' | 'top';
}) {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className={'appnav ' + variant}>
      {items.map(([href, label, Icon]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (href === '/app' ? path === href : path.startsWith(href))
              ? 'page'
              : undefined
          }
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
