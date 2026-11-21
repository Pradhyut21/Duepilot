import { workspace, sessionForRequest } from '@/lib/studio/data';
import { Profile } from '@/components/studio/Profile';
import { Brand } from '@/components/studio/Brand';
export default async function Page() {
  const s = await workspace(),
    u = await sessionForRequest();
  return (
    <main className="setup">
      <Brand />
      <div className="panel">
        <h1>Set up your studio</h1>
        <p>
          Start with the cash available at the beginning of your opening date.
        </p>
        <Profile
          p={s.profile}
          today={s.asOf}
          owner={u!.user.displayName}
          onboarding
        />
      </div>
    </main>
  );
}
