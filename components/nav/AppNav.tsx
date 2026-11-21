'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const APP_NAV_ITEMS = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/clients', label: 'Clients' },
  { href: '/app/invoices', label: 'Invoices' },
  { href: '/app/payments', label: 'Payments' },
  { href: '/app/expenses', label: 'Expenses' },
  { href: '/app/forecast', label: 'Forecast' },
  { href: '/app/scenarios', label: 'Scenarios' },
  { href: '/app/actions', label: 'Actions' },
  { href: '/app/settings', label: 'Settings' },
] as const;

export interface AppNavProps {
  variant?: 'sidebar' | 'top';
}

/**
 * Primary app navigation. The active item gets aria-current="page" and a heavier
 * font weight, so the state is not conveyed by colour alone.
 */
export function AppNav({ variant = 'sidebar' }: AppNavProps) {
  const pathname = usePathname();
  const isSidebar = variant === 'sidebar';

  const isActive = (href: string): boolean =>
    href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Main navigation" className={isSidebar ? 'px-3 pb-6' : 'overflow-x-auto'}>
      <ul className={isSidebar ? 'space-y-1' : 'flex min-w-max gap-1 px-2 py-2'}>
        {APP_NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const linkClass = [
            'block rounded-md px-3 text-sm',
            isSidebar ? 'py-2' : 'whitespace-nowrap py-1.5',
            active
              ? 'bg-accent/10 font-semibold text-accent'
              : 'font-normal text-ink/80 hover:bg-slate-100 hover:text-ink',
          ].join(' ');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={linkClass}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

