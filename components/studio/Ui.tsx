import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Wallet,
  FileText,
  Clock3,
  CalendarDays,
  TrendingDown,
} from 'lucide-react';
import { money } from '@/lib/studio/format';
import type { Forecast } from '@/lib/finance/forecast';
export function Heading({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <header className="pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </header>
  );
}
export function Panel({
  title,
  children,
  link,
  id,
}: {
  title: string;
  children: ReactNode;
  link?: [string, string];
  id?: string;
}) {
  return (
    <section id={id} className="panel">
      <header>
        <h2>{title}</h2>
        {link && <Link href={link[0]}>{link[1]}</Link>}
      </header>
      {children}
    </section>
  );
}
export function Metrics({ f }: { f: Forecast }) {
  return (
    <div className="metrics">
      {[
        { name: 'Recorded cash', v: f.cash, icon: Wallet },
        { name: 'Outstanding', v: f.outstanding, icon: FileText },
        { name: 'Overdue', v: f.overdue, icon: Clock3 },
        { name: 'Bills in 30 days', v: f.unpaidBills30, icon: CalendarDays },
        {
          name: 'Lowest projection',
          v: f.lowest.closingBalancePaise,
          icon: TrendingDown,
        },
      ].map(({ name, v, icon: Icon }) => (
        <div key={name}>
          <Icon size={19} />
          <span>{name}</span>
          <strong>{money(v)}</strong>
        </div>
      ))}
    </div>
  );
}
export function Quiet({ children }: { children: ReactNode }) {
  return <p className="quiet">{children}</p>;
}
export function RecordRow({
  name,
  meta,
  value,
  href,
}: {
  name: string;
  meta: string;
  value?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div>
        <strong>{name}</strong>
        <small>{meta}</small>
      </div>
      {value && <b>{value}</b>}
    </>
  );
  return href ? (
    <Link className="recordrow" href={href}>
      {inner}
    </Link>
  ) : (
    <div className="recordrow">{inner}</div>
  );
}
