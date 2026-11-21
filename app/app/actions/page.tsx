import Link from 'next/link';
import { workspace } from '@/lib/studio/data';
import { forecast } from '@/lib/finance/forecast';
import { studioAlerts } from '@/lib/studio/alerts';
import { Heading, Panel, Quiet } from '@/components/studio/Ui';
import { StudioForm, Hidden } from '@/components/forms/StudioForm';
export default async function Page() {
  const s = await workspace(),
    rows = studioAlerts(s, forecast(s, s.profile.horizon));
  return (
    <>
      <Heading
        title="Action centre"
        sub="Follow up on overdue receipts and prepare for upcoming obligations."
      />
      {rows.map((r) => (
        <Panel key={r.key} title={r.title}>
          <span className="status amber">
            {r.severity} · {r.status.toLowerCase()}
          </span>
          <p>{r.explanation}</p>
          <div className="actions">
            <Link className="button" href={r.link}>
              {r.next}
            </Link>
            {(r.status === 'OPEN' ? ['DISMISSED', 'RESOLVED'] : ['OPEN']).map(
              (v) => (
                <StudioForm
                  className="inlineform"
                  key={v}
                  action="alert"
                  label={
                    v === 'OPEN'
                      ? 'Reopen'
                      : v === 'DISMISSED'
                        ? 'Dismiss'
                        : 'Resolve'
                  }
                >
                  <Hidden name="key" value={r.key} />
                  <Hidden name="status" value={v} />
                </StudioForm>
              ),
            )}
          </div>
        </Panel>
      ))}
      {!rows.length && <Quiet>No outstanding actions.</Quiet>}
    </>
  );
}
