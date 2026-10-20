import Link from 'next/link';
import { and, asc, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/db';
import { deals, events, promotions } from '@/db/schema';
import { isVendorUser, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { classifyFunding, dealEcon } from '@/lib/economics';
import { isoToday, MONTHS } from '@/lib/format';
import { PageHead } from '@/components/ui';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; pending?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const today = isoToday();
  const base = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : today.slice(0, 7);
  const [y, m] = base.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 + i, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const ws = `${base}-01`, weD = new Date(Date.UTC(y, m - 1 + 6, 0)), we = weD.toISOString().slice(0, 10);
  const total = (Date.parse(we) - Date.parse(ws)) / 86400000 + 1;
  const pos = (a: string, b: string) => { const s = a < ws ? ws : a, e = b > we ? we : b; if (s > e) return null; return { left: ((Date.parse(s) - Date.parse(ws)) / 86400000) / total * 100, width: ((Date.parse(e) - Date.parse(s)) / 86400000 + 1) / total * 100 }; };
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const showPending = sp.pending !== '0';
  const vendor = isVendorUser(me);
  const { values: r } = await currentRules();
  const evs = await db.select().from(events).where(and(lte(events.startDate, we), gte(events.endDate, ws))).orderBy(asc(events.startDate));
  const statuses = showPending ? ['APPROVED', 'SUBMITTED', 'SENT_BACK'] as const : ['APPROVED'] as const;
  const ds = (await db.query.deals.findMany({ where: and(inArray(deals.status, [...statuses]), lte(deals.startDate, we), gte(deals.endDate, ws)), with: { vendor: true, lines: true } })).filter(d => !vendor || d.vendorId === me.vendor?.id);
  const ps = vendor || !evs.length ? [] : await db.query.promotions.findMany({ where: inArray(promotions.eventId, evs.map(e => e.id)), with: { event: true } });
  const todayPos = today >= ws && today <= we ? ((Date.parse(today) - Date.parse(ws)) / 86400000) / total * 100 : null;
  const track = (inner: React.ReactNode) => <div className="track">{todayPos != null && <div className="today" style={{ left: `${todayPos}%` }} />}{inner}</div>;
  return (
    <>
      <PageHead title="Promo calendar" sub={`${MONTHS[months[0].m]} ${months[0].y} – ${MONTHS[months[5].m]} ${months[5].y}. Solid bars are approved; faded dashed bars are still in review. Colors show funding: green vendor funded, amber shared, grey retailer funded.`}>
        <Link className="btn" href={`/calendar?m=${shift(-1)}${showPending ? '' : '&pending=0'}`}>‹ Earlier</Link><Link className="btn" href="/calendar">Today</Link><Link className="btn" href={`/calendar?m=${shift(1)}${showPending ? '' : '&pending=0'}`}>Later ›</Link>
        <Link className="btn" href={`/calendar?m=${base}${showPending ? '&pending=0' : ''}`}>{showPending ? 'Hide deals in review' : 'Show deals in review'}</Link>
      </PageHead>
      <section className="panel tbl"><div className="cal">
        <div className="cal-head"><div className="small muted" style={{ padding: '8px 10px' }}>{ds.length} deals{ps.length ? ` · ${ps.length} retailer promos` : ''}</div><div className="cal-months">{months.map(x => <div key={`${x.y}${x.m}`}>{MONTHS[x.m]} {x.y}</div>)}</div></div>
        {evs.map(e => {
          const p = pos(e.startDate, e.endDate);
          const eds = ds.filter(d => d.eventId === e.id), eps = ps.filter(x => x.eventId === e.id);
          return <div key={e.id}>
            <div className="cal-row grp"><div className="lab"><Link href={`/events/${e.id}`}>{e.name}</Link></div>{track(p && <Link className="bar ev" href={`/events/${e.id}`} style={{ left: `${p.left}%`, width: `${p.width}%` }}>{e.name}</Link>)}</div>
            {eds.map(d => { const q = pos(d.startDate, d.endDate); const x = dealEcon({ lines: d.lines, startDate: d.startDate, endDate: d.endDate, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits }); const c = classifyFunding(x.markdown, x.totalFunds, r.fullFund).cls;
              return <div className="cal-row" key={d.id}><div className="lab" title={`${d.vendor.name} · ${d.title}`}>{d.vendor.name} · {d.title}</div>{track(q && <Link className={`bar ${c === 'Vendor funded' ? 'fv' : c === 'Shared' ? 'fs' : 'fr'} ${d.status !== 'APPROVED' ? 'pending' : ''}`} href={`/deals/${d.id}`} style={{ left: `${q.left}%`, width: `${q.width}%` }} title={`${d.number} · ${c}`}>{d.number} · {c}</Link>)}</div>; })}
            {eps.map(x => { const q = pos(x.event.startDate, x.event.endDate); return <div className="cal-row" key={x.id}><div className="lab">{x.name}</div>{track(q && <Link className="bar fr" href="/promotions" style={{ left: `${q.left}%`, width: `${q.width}%` }}>{x.number} · Retailer funded</Link>)}</div>; })}
          </div>;
        })}
        {!evs.length && <div className="empty">No events in these months.</div>}
      </div></section>
    </>
  );
}
