'use client';
import { useState } from 'react';
import {
  Aperture,
  CalendarDays,
  TrendingUp,
  Clock3,
  Wallet,
} from 'lucide-react';
import { Chart } from './Chart';
import { previewLedger } from '@/lib/finance/sample';
import { money, dayLabel } from '@/lib/studio/format';
export function Preview() {
  const [late, setLate] = useState(false),
    baseline = previewLedger(),
    changed = previewLedger(15),
    v = late ? changed : baseline;
  const low = v.days.reduce((a, b) =>
    a.closingBalancePaise <= b.closingBalancePaise ? a : b,
  );
  return (
    <div className="preview-stage" id="preview">
      <div className="preview">
        <div className="previewbar">
          <span>
            <Aperture size={17} />
            Aperture Studio
          </span>
          <b>Sample data</b>
        </div>
        <div className="previewbody">
          <div className="previewhead">
            <div>
              <small>Cash forecast</small>
              <h2>Studio cash outlook</h2>
            </div>
            <CalendarDays size={21} />
          </div>
          <div className="previewstats">
            <div>
              <span>
                <Wallet size={15} />
                Recorded cash
              </span>
              <b>₹18,000</b>
            </div>
            <div>
              <span>
                <TrendingUp size={15} />
                Lowest projection
              </span>
              <b className={late ? 'error' : ''}>
                {money(low.closingBalancePaise)}
              </b>
            </div>
          </div>
          <Chart
            days={baseline.days}
            cash={1800000}
            comparison={late ? changed.days : undefined}
            compact
          />
          <div className="previewtoggle">
            <span>
              <Clock3 size={17} />
              Client pays 15 days late
            </span>
            <button
              role="switch"
              aria-checked={late}
              aria-label="Simulate a 15-day delay"
              onClick={() => setLate(!late)}
            >
              <i />
            </button>
          </div>
          <small className="previewnote" aria-live="polite">
            {late
              ? 'First shortfall on ' +
                dayLabel(changed.firstNegativeDate!) +
                '.'
              : '21 Nov – 12 Dec 2026 · Baseline'}
          </small>
        </div>
      </div>
    </div>
  );
}
