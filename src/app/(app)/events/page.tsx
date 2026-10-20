import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { events } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { eventFunding } from '@/lib/funding';
import { addDays, fdate, kmoney, pct } from '@/lib/format';
import { Empty, Flash, PageHead } from '@/components/ui';

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const all = await db.select().from(events).orderBy(asc(events.startDate));
  const quarters = [...new Set(all.map(e => e.quarter))];
  const q = sp.q && quarters.includes(sp.q) ? sp.q : (all.find(e => e.status !== 'COMPLETED')?.quarter ?? quarters[0]);
  const list = all.filter(e => e.quarter === q);
  const f = await eventFunding(list.map(e => e.id));
  const { values: r } = await currentRules();
  const tot = list.reduce((a, e) => { const x = f.get(e.id)!; return { media: a.media + e.mediaBudget, target: a.target + e.fundingTarget, com: a.com + x.committed, pen: a.pen + x.pending, rtl: a.rtl + x.retailerMarkdown }; }, { media: 0, target: 0, com: 0, pen: 0, rtl: 0 });
  return (
    <>
      <PageHead title="Event plans" sub="Quarterly plans with ad themes, vehicles, media spend and vendor funding targets. Vendor deals and retailer-funded promotions attach to an event.">
        {can(me, 'plan_events') && <Link className="btn primary" href="/events/new">New event</Link>}
      </PageHead>
      <Flash sp={sp} />
      <div className="toolbar"><div className="seg">{quarters.map(x => <Link key={x} href={`/events?q=${encodeURIComponent(x)}`} aria-current={x === q ? 'true' : undefined}>{x}</Link>)}</div></div>
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Events</div><div className="v">{list.length}</div><div className="s">{q}</div></div>
        <div className="kpi"><div className="eyebrow">Media plan</div><div className="v">{kmoney(tot.media)}</div></div>
        <div className="kpi"><div className="eyebrow">Funding target</div><div className="v">{kmoney(tot.target)}</div></div>
        <div className="kpi"><div className="eyebrow">Committed</div><div className="v">{kmoney(tot.com)}</div><div className="s">{pct(tot.com / Math.max(1, tot.target))} of target</div></div>
        <div className="kpi"><div className="eyebrow">Pending</div><div className="v">{kmoney(tot.pen)}</div></div>
        <div className="kpi"><div className="eyebrow">Retailer-funded markdown</div><div className="v">{kmoney(tot.rtl)}</div></div>
      </div>
      <section className="panel"><div className="tbl"><table><thead><tr><th>Event</th><th>Dates</th><th>Deal cutoff</th><th>Vehicles</th><th className="num">Media</th><th className="num">Committed</th><th className="num">Pending</th><th className="num">Target</th><th>Status</th></tr></thead><tbody>
        {list.map(e => { const x = f.get(e.id)!; return <tr key={e.id}><td><Link className="rowlink" href={`/events/${e.id}`}>{e.name}</Link><div className="small muted">{e.code} · {e.theme}</div></td>
          <td className="small">{fdate(e.startDate)} – {fdate(e.endDate)}</td><td className="small">{fdate(addDays(e.startDate, -r.cutoffDays))}</td><td className="small">{e.vehicles.join(', ')}</td>
          <td className="num">{kmoney(e.mediaBudget)}</td><td className="num">{kmoney(x.committed)}</td><td className="num">{kmoney(x.pending)}</td><td className="num">{kmoney(e.fundingTarget)}</td>
          <td><span className={`pill ${e.status === 'PLANNING' ? 'info' : e.status === 'LOCKED' ? 'good' : 'acc'}`}>{e.status.toLowerCase()}</span></td></tr>; })}
      </tbody></table>{!list.length && <Empty>No events yet.</Empty>}</div></section>
    </>
  );
}
