import { requireUser } from '@/lib/auth';
import { guideFor } from '@/lib/guides';
import { Flash, PageHead } from '@/components/ui';
import { Walkthrough } from '@/components/Walkthrough';

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  if (!guideFor(me.role.name)) return <PageHead title="Guided walkthrough" sub={`There is no walkthrough for the ${me.role.name} role yet. See How to use Fundline.`} />;
  return (
    <>
      <PageHead title="Guided walkthrough" sub="The core workflow for your role, step by step. Steps tick themselves off when you do them; use Mark done if another tester already handled the sample deal." />
      <Flash sp={sp} />
      <Walkthrough me={me} from="guide" />
    </>
  );
}
