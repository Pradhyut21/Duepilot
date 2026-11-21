import { useId } from 'react';
import type { LedgerDay } from '@/lib/finance';
import { money, dayLabel } from '@/lib/studio/format';
export function Chart({
  days,
  cash,
  comparison,
  compact = false,
}: {
  days: LedgerDay[];
  cash: number;
  comparison?: LedgerDay[];
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  if (!days.length) return null;
  const values = [
    cash,
    ...days.map((d) => d.closingBalancePaise),
    ...(comparison ?? []).map((d) => d.closingBalancePaise),
  ];
  const lo = Math.min(0, ...values),
    hi = Math.max(100, ...values),
    range = hi - lo;
  const left = 69,
    right = 628,
    top = 20,
    bottom = 173;
  const y = (v: number) => bottom - ((v - lo) / range) * (bottom - top),
    x = (i: number) => left + ((i + 1) * (right - left)) / days.length;
  const path = (data: LedgerDay[]) =>
    'M' +
    left +
    ' ' +
    y(cash) +
    ' ' +
    data.map((d, i) => 'H' + x(i) + 'V' + y(d.closingBalancePaise)).join(' ');
  const ticks = [hi, lo + (range * 2) / 3, lo + range / 3, lo];
  const baseline = path(days);
  return (
    <div className={'cashchart ' + (compact ? 'compact' : '')}>
      <svg
        role="img"
        aria-label={
          'Daily cash projection from ' +
          money(cash) +
          ' to ' +
          money(days.at(-1)!.closingBalancePaise)
        }
        viewBox="0 0 650 208"
      >
        <defs>
          <linearGradient id={'fill' + id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7960ed" stopOpacity=".19" />
            <stop offset="100%" stopColor="#7960ed" stopOpacity=".015" />
          </linearGradient>
        </defs>
        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={left}
              x2={right}
              y1={y(v)}
              y2={y(v)}
              stroke="#e0dfea"
              strokeDasharray="3 5"
            />
            <text x={left - 10} y={y(v) + 4} textAnchor="end">
              {Math.abs(v) >= 100000
                ? '₹' + (v / 100000).toFixed(1) + 'k'
                : money(Math.round(v / 100) * 100)}
            </text>
          </g>
        ))}
        {lo < 0 && (
          <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="#a88a84" />
        )}
        <path
          d={baseline + 'V' + bottom + 'H' + left + 'Z'}
          fill={'url(#fill' + id + ')'}
        />
        <path
          d={baseline}
          fill="none"
          stroke="#6750df"
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        {comparison && (
          <path
            d={path(comparison)}
            fill="none"
            stroke="#b45a24"
            strokeWidth={3}
            strokeDasharray="7 4"
          />
        )}
        <circle
          cx={left}
          cy={y(cash)}
          r="4.8"
          fill="#172641"
          stroke="white"
          strokeWidth={2}
        />
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const i = Math.round(frac * (days.length - 1));
          return (
            <text
              key={frac}
              x={x(i)}
              y="198"
              textAnchor={frac === 1 ? 'end' : 'middle'}
            >
              {dayLabel(days[i].date)}
            </text>
          );
        })}
      </svg>
      <div className="legend">
        <span>
          <i className="dot navy" />
          Recorded cash
        </span>
        <span>
          <i />
          Baseline projection
        </span>
        {comparison && (
          <span>
            <i className="dash" />
            Scenario
          </span>
        )}
      </div>
    </div>
  );
}
