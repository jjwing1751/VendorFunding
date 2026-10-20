import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { dealLines, deals, events, items, promotionLines, promotions, vendors } from '@/db/schema';
import { can, isVendorUser, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { lineCalc } from '@/lib/economics';
import { fdate, pct } from '@/lib/format';
import { Flash, PageHead, StatusPill } from '@/components/ui';
import { ItemForm } from '../ItemForm';

export default async function ItemPage({ params, searchParams }: { params: Promise<{ upc: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  const upc = decodeURIComponent((await params).upc);
  const it = (await db.select().from(items).where(eq(items.upc, upc)))[0];
  if (!it || (isVendorUser(me) && it.vendorId !== me.vendor?.id)) notFound();
  const sp = await searchParams;
  const { values: r } = await currentRules();
  const dl = await db.select({ l: dealLines, d: deals, ev: events, v: vendors }).from(dealLines).innerJoin(deals, eq(deals.id, dealLines.dealId)).innerJoin(events, eq(events.id, deals.eventId)).innerJoin(vendors, eq(vendors.id, deals.vendorId)).where(eq(dealLines.upc, upc)).orderBy(asc(deals.startDate));
  const pl = isVendorUser(me) ? [] : await db.select({ l: promotionLines, p: promotions, ev: events }).from(promotionLines).innerJoin(promotions, eq(promotions.id, promotionLines.promotionId)).innerJoin(events, eq(events.id, promotions.eventId)).where(eq(promotionLines.upc, upc));
  const active = dl.filter(x => ['SUBMITTED', 'SENT_BACK', 'APPROVED'].includes(x.d.status) && x.d.accrualPct === 0);
  const overlaps: string[] = [];
  active.forEach((a, i) => active.slice(i + 1).forEach(b => { if (a.d.startDate <= b.d.endDate && b.d.startDate <= a.d.endDate) overlaps.push(`${a.d.number} and ${b.d.number}`); }));
  const vs = can(me, 'manage_items') ? await db.select({ id: vendors.id, name: vendors.name }).from(vendors).orderBy(asc(vendors.name)) : [];
  return (
    <>
      <PageHead title={it.description} sub={`${it.upc} · ${it.size ?? ''} ${it.uom ?? ''} · pack ${it.casePack} · unit cost $${(it.caseCost / it.casePack).toFixed(2)} · regular retail $${it.regularRetail.toFixed(2)} · regular GM ${pct((it.regularRetail - it.caseCost / it.casePack) / it.regularRetail, 1)}`} />
      <Flash sp={sp} />
      {overlaps.length > 0 && <div className="callout Review"><b>Overlapping deals on this UPC:</b> {overlaps.join('; ')}. Confirm they are meant to stack.</div>}
      <section className="panel"><div className="panel-h"><h2>Deal and promotion history</h2><span className="pill">{dl.length + pl.length}</span></div><div className="tbl"><table><thead><tr><th>ID</th><th>Event</th><th>Source</th><th className="num">Net unit cost</th><th className="num">Promo</th><th className="num">Vendor $/unit</th><th>Funded</th><th>Status</th></tr></thead><tbody>
        {dl.map(({ l, d, ev, v }) => { const c = lineCalc(l); return <tr key={l.id}><td><Link className="id" href={`/deals/${d.id}`}>{d.number}</Link></td><td className="small">{ev.name}<div className="muted">{fdate(d.startDate)} – {fdate(d.endDate)}</div></td><td className="small">{v.name}</td><td className="num">${c.netUnitCost.toFixed(2)}</td><td className="num">${c.promo.toFixed(2)}</td><td className="num">${(c.vendorPU + c.whPU).toFixed(2)}</td><td>{c.share == null ? '—' : <span className={`pill ${c.share >= r.fullFund ? 'good' : c.share > 0 ? 'warn' : ''}`}>{pct(c.share)}</span>}</td><td><StatusPill s={d.status} auto={d.autoApproved} /></td></tr>; })}
        {pl.map(({ l, p, ev }) => <tr key={l.id}><td><span className="id">{p.number}</span></td><td className="small">{ev.name}<div className="muted">{fdate(ev.startDate)} – {fdate(ev.endDate)}</div></td><td className="small">Retailer funded · {p.reason}</td><td className="num">${l.unitCost.toFixed(2)}</td><td className="num">${l.promoRetail.toFixed(2)}</td><td className="num">$0.00</td><td><span className="pill">0%</span></td><td><span className="pill">Planned</span></td></tr>)}
      </tbody></table>{!dl.length && !pl.length && <div className="empty">This UPC has not been on a deal or promotion.</div>}</div></section>
      {can(me, 'manage_items') && <section className="panel"><div className="panel-h"><h2>Edit item</h2></div><div className="panel-b"><ItemForm item={it} vendors={vs} /></div></section>}
    </>
  );
}
