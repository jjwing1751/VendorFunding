import { can, requireUser } from '@/lib/auth';
import { Flash, PageHead } from '@/components/ui';
import { EventForm } from '../EventForm';

export default async function NewEvent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'plan_events')) return <PageHead title="New event" sub={`Your role (${me.role.name}) can’t plan events.`} />;
  return <><PageHead title="New event" sub="Vendors can submit deals to an event until its deal cutoff." /><Flash sp={await searchParams} /><section className="panel"><div className="panel-b"><EventForm /></div></section></>;
}
