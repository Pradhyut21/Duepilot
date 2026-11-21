import { workspace, sessionForRequest } from '@/lib/studio/data';
import { Heading, Panel } from '@/components/studio/Ui';
import { Profile } from '@/components/studio/Profile';
import { StudioForm } from '@/components/forms/StudioForm';
export default async function Page() {
  const s = await workspace(),
    u = await sessionForRequest();
  return (
    <>
      <Heading
        title="Settings"
        sub="Studio profile, forecast policy and account access."
      />
      <Panel title="Business profile">
        <Profile p={s.profile} today={s.asOf} owner={u!.user.displayName} />
      </Panel>
      <Panel title="Account and data">
        <p>
          {s.profile.isDemo ? 'Demo workspace' : u!.user.email} · Indian rupees
          (INR) · Asia/Kolkata
        </p>
        <a className="button secondary" href="/api/studio" download>
          Export studio records
        </a>
        {s.profile.isDemo && (
          <StudioForm
            action="demo.reset"
            confirm="Reset this sample studio to its original records?"
            label="Reset demo workspace"
          />
        )}
      </Panel>
    </>
  );
}
