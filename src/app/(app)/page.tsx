import Link from 'next/link';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { deals, events, fundingRequests, promotions, users } from '@/db/schema';
import { can, inScope, isVendorUser, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { addDays, daysBetween, fdate, isoToday } from '@/lib/format';
import { Flash, PageHead } from '@/components/ui';
import { Walkthrough } from '@/components/Walkthrough';

type Task = { tone: string; title: string; detail: string; due: string; href: string; cta: string };

function Due({ due }: { due: string }) {
  const n = daysBetween(isoToday(), due);
  if (n < 0) return <span className="pill bad">{-n} day{n < -1 ? 's' : ''} overdue</span>;
  if (n === 0) return <span className="pill warn">Due today</span>;
  return <span className={`pill ${n <= 7 ? 'warn' : ''}`}>Due {fdate(due)}</span>;
}

export default async function MyWork({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const { values: r } = await currentRules();
  const today = isoToday();
  const tasks: Task[] = [];
  const waiting: Task[] = [];

  if (isVendorUser(me)) {
    const v = me.vendor!;
    const mine = await db.query.deals.findMany({ where: and(eq(deals.vendorId, v.id), inArray(deals.status, ['DRAFT', 'SENT_BACK', 'SUBMITTED'])), with: { event: true } });
    for (const d of mine) {
      if (d.status === 'SENT_BACK') tasks.push({ tone: 'warn', title: `Respond to changes on ${d.number}`, detail: `${d.title}. ${d.decisionNote ?? ''}`, due: addDays((d.decidedAt ?? new Date()).toISOString().slice(0, 10), 5), href: `/deals/${d.id}`, cta: d.counterRate ? 'Review counter' : 'Open deal' });
      if (d.status === 'DRAFT') tasks.push({ tone: 'info', title: `Finish and submit ${d.number}`, detail: `${d.title} for ${d.event.name}.`, due: addDays(d.event.startDate, -r.cutoffDays), href: `/deals/${d.id}`, cta: 'Open draft' });
      if (d.status === 'SUBMITTED') waiting.push({ tone: '', title: `${d.number} · ${d.title}`, detail: `Waiting on the retailer’s decision`, due: addDays((d.submittedAt ?? new Date()).toISOString().slice(0, 10), r.reviewDays), href: `/deals/${d.id}`, cta: 'Open' });
    }
    const reqs = await db.select().from(fundingRequests).where(and(eq(fundingRequests.vendorId, v.id), eq(fundingRequests.status, 'OPEN')));
    const evById = new Map((await db.select().from(events)).map(e => [e.id, e]));
    for (const q of reqs) { const e = evById.get(q.eventId)!; tasks.push({ tone: 'good', title: `Funding request: ${q.text}`, detail: `For ${e.name}, ${fdate(e.startDate)} – ${fdate(e.endDate)}.`, due: addDays(e.startDate, -r.cutoffDays), href: '/deals/new', cta: 'Start a deal' }); }
    const open = (await db.select().from(events).where(eq(events.status, 'PLANNING')).orderBy(asc(events.startDate))).filter(e => addDays(e.startDate, -r.cutoffDays) >= today && !mine.some(d => d.eventId === e.id)).slice(0, 3);
    for (const e of open) tasks.push({ tone: '', title: `Submit deals for ${e.name}`, detail: `${e.theme ?? ''} Vehicles: ${e.vehicles.join(', ')}.`, due: addDays(e.startDate, -r.cutoffDays), href: '/deals/new', cta: 'Start a deal' });
  } else {
    if (can(me, 'approve_deals')) {
      const sub = await db.query.deals.findMany({ where: inArray(deals.status, ['SUBMITTED', 'SENT_BACK']), with: { vendor: true } });
      for (const d of sub) {
        if (d.status === 'SUBMITTED' && inScope(me, d.vendor.category) && d.createdById !== me.user.id)
          tasks.push({ tone: 'warn', title: `Decide on ${d.number} · ${d.vendor.name}`, detail: d.title, due: addDays((d.submittedAt ?? new Date()).toISOString().slice(0, 10), r.reviewDays), href: `/deals/${d.id}`, cta: 'Review contract' });
        if (d.status === 'SENT_BACK' && inScope(me, d.vendor.category))
          waiting.push({ tone: '', title: `${d.number} · ${d.vendor.name}`, detail: 'Waiting on the vendor to respond', due: addDays((d.decidedAt ?? new Date()).toISOString().slice(0, 10), 5), href: `/deals/${d.id}`, cta: 'Open' });
      }
    }
    if (can(me, 'plan_events')) {
      const evs = await db.select().from(events).where(eq(events.status, 'PLANNING')).orderBy(asc(events.startDate));
      for (const e of evs) { const cutoff = addDays(e.startDate, -r.cutoffDays); if (daysBetween(today, cutoff) <= 14) tasks.push({ tone: 'info', title: `Lock the ${e.name} plan`, detail: `Deal cutoff ${fdate(cutoff)}. Locking stops new vendor submissions and releases the plan to production.`, due: cutoff, href: `/events/${e.id}`, cta: 'Open event' }); }
    }
    if (can(me, 'add_retail_promos')) {
      const ps = await db.query.promotions.findMany({ where: and(eq(promotions.fundingRequested, false)), with: { brandVendor: true, event: true } });
      for (const p of ps) if (p.brandVendor && p.event.status !== 'COMPLETED') tasks.push({ tone: 'warn', title: `Ask ${p.brandVendor.name} to fund ${p.number}`, detail: `${p.name} is retailer funded (${p.reason.toLowerCase()}).`, due: addDays(p.event.startDate, -r.cutoffDays), href: '/promotions', cta: 'Request funding' });
    }
    if (can(me, 'manage_users')) {
      const locked = await db.select().from(users).where(and(eq(users.status, 'ACTIVE'), sql`${users.lockedUntil} > now()`));
      for (const u of locked) tasks.push({ tone: 'bad', title: `${u.name} is locked out`, detail: 'Too many failed sign-ins. Unlock or reset their password if they ask.', due: today, href: `/admin/users/${u.id}`, cta: 'Open user' });
      const never = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(eq(users.status, 'ACTIVE'), isNull(users.lastLoginAt)));
      if (never[0].n) waiting.push({ tone: '', title: `${never[0].n} user${never[0].n > 1 ? 's have' : ' has'} not signed in yet`, detail: 'They have a temporary password to use.', due: today, href: '/admin/users', cta: 'Users' });
    }
  }
  tasks.sort((a, b) => a.due < b.due ? -1 : 1);
  const overdue = tasks.filter(t => t.due < today).length;
  return (
    <>
      <PageHead title={`Good to see you, ${me.user.name.split(' ')[0]}`} sub={isVendorUser(me) ? `What the retailer needs from ${me.vendor!.name}, in date order.` : 'Your queue in date order. Deals that pass every rule are approved automatically.'} />
      <Flash sp={sp} />
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">To do</div><div className="v">{tasks.length}</div><div className="s">{overdue} overdue</div></div>
        <div className="kpi"><div className="eyebrow">Waiting on others</div><div className="v">{waiting.length}</div><div className="s">{isVendorUser(me) ? 'With the retailer' : 'With vendors or users'}</div></div>
        <div className="kpi"><div className="eyebrow">Your role</div><div className="v" style={{ fontSize: 16 }}>{me.role.name}</div><div className="s">{isVendorUser(me) ? me.vendor!.name : can(me, 'all_categories') ? 'All categories' : me.user.categories.join(', ') || 'No categories assigned'}</div></div>
      </div>
      {me.user.demo && <Walkthrough me={me} from="home" />}
      <div className="grid-main">
        <section className="panel"><div className="panel-h"><h2>To do</h2></div><div className="list">
          {tasks.map((t, i) => <div className="li" key={i}><span className={`stripe ${t.tone}`} /><div className="grow"><div className="t">{t.title}</div><div className="d">{t.detail}</div></div><div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}><Due due={t.due} /><Link className="btn sm" href={t.href}>{t.cta}</Link></div></div>)}
          {!tasks.length && <div className="empty">Nothing needs you right now.</div>}
        </div></section>
        <section className="panel"><div className="panel-h"><h2>Waiting on others</h2></div><div className="list">
          {waiting.map((t, i) => <div className="li" key={i}><div className="grow"><Link className="t" href={t.href} style={{ textDecoration: 'none' }}>{t.title}</Link><div className="d">{t.detail}</div></div><Due due={t.due} /></div>)}
          {!waiting.length && <div className="empty">Nothing outstanding.</div>}
        </div></section>
      </div>
    </>
  );
}
