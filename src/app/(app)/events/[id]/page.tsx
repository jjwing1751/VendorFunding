import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { deals, events, promotions } from '@/db/schema';
import { can, isVendorUser, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { dealEcon, promoEcon } from '@/lib/economics';
import { addDays, fdate, money } from '@/lib/format';
import { Flash, FundPill, PageHead, StatusPill } from '@/components/ui';
import { EventForm } from '../EventForm';
import { setEventStatus } from '../actions';
import { EventPerformance } from '@/components/EventPerformance';

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  const e = (await db.select().from(events).where(eq(events.id, (await params).id)))[0];
  if (!e) notFound();
  const sp = await searchParams;
  const { values: r } = await currentRules();
  const vendor = isVendorUser(me);
  const ds = (await db.query.deals.findMany({ where: eq(deals.eventId, e.id), with: { vendor: true, lines: true } })).filter(d => !vendor || d.vendorId === me.vendor?.id);
  const ps = vendor ? [] : await db.query.promotions.findMany({ where: eq(promotions.eventId, e.id), with: { lines: true, brandVendor: true } });
  return (
    <>
      <PageHead title={e.name} sub={`${e.code} · ${fdate(e.startDate)} – ${fdate(e.endDate)} · deal cutoff ${fdate(addDays(e.startDate, -r.cutoffDays))} · ${e.status.toLowerCase()}`}>
        {can(me, 'plan_events') && e.status === 'PLANNING' && <form action={setEventStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="LOCKED" /><button className="btn primary">Lock plan</button></form>}
        {can(me, 'plan_events') && e.status === 'LOCKED' && <><form action={setEventStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="PLANNING" /><button className="btn">Reopen</button></form><form action={setEventStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="COMPLETED" /><button className="btn">Mark completed</button></form></>}
      </PageHead>
      <Flash sp={sp} />
      <EventPerformance me={me} e={e} />
      <section className="panel"><div className="panel-h"><h2>Deals</h2><span className="pill">{ds.length}</span></div><div className="tbl"><table><thead><tr><th>Deal</th><th>Vendor</th><th>Title</th><th className="num">Vendor funding</th><th>Funding</th><th>Status</th></tr></thead><tbody>
        {ds.map(d => { const x = dealEcon({ lines: d.lines, startDate: d.startDate, endDate: d.endDate, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits }); return <tr key={d.id}><td><Link className="id" href={`/deals/${d.id}`}>{d.number}</Link></td><td>{d.vendor.name}</td><td>{d.title}</td><td className="num">{money(x.totalFunds)}</td><td><FundPill markdown={x.markdown} vendorFunds={x.totalFunds} threshold={r.fullFund} /></td><td><StatusPill s={d.status} auto={d.autoApproved} /></td></tr>; })}
      </tbody></table></div></section>
      {!vendor && <section className="panel"><div className="panel-h"><h2>Retailer-funded promotions</h2><span className="pill">{ps.length}</span></div><div className="tbl"><table><thead><tr><th>Promotion</th><th>Brand</th><th>Reason</th><th className="num">Markdown</th></tr></thead><tbody>
        {ps.map(p => <tr key={p.id}><td><span className="id">{p.number}</span> {p.name}</td><td>{p.brandVendor?.name ?? 'Own brand / fresh'}</td><td>{p.reason}</td><td className="num">{money(promoEcon(p.lines, e.startDate, e.endDate).markdown)}</td></tr>)}
      </tbody></table></div></section>}
      {can(me, 'plan_events') && <section className="panel"><div className="panel-h"><h2>Edit event</h2></div><div className="panel-b"><EventForm e={e} /></div></section>}
    </>
  );
}
