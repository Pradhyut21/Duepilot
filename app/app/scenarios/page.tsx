import { workspace } from '@/lib/studio/data';
import { forecast } from '@/lib/finance/forecast';
import { ScenarioLab } from './ScenarioLab';
import { Heading } from '@/components/studio/Ui';
export default async function Page() {
  const s = await workspace();
  return (
    <>
      <Heading
        title="Scenario Lab"
        sub="Explore how a late receipt or a changed bill would affect daily cash."
      />
      <ScenarioLab s={s} baseline={forecast(s, s.profile.horizon)} />
    </>
  );
}
