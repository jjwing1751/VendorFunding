import Link from 'next/link';
import { asc, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/db';
import { events, promotions } from '@/db/schema';
import { can, isVendorUser, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { classifyFunding, dealEcon, DEAL_TYPE_LABEL, promoEcon } from '@/lib/economics';
import { fdate, kmoney, money, pct } from '@/lib/format';
import { Empty, Flash, FundPill, MixBar, PageHead, StatusPill } from '@/components/ui';
import { requestFunding } from './actions';

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; ok?: string; error?: string }> }) {
  const me = await requireUser();
  if (isVendorUser(me)) return <PageHead title="Promotions & funding" sub="This view is for retailer users." />;
  const sp = await searchParams;
  const { values: r } = await currentRules();
  const allEv = await db.select().from(events).orderBy(asc(events.startDate));
  const quarters = [...new Set(allEv.map(e => e.quarter))];
  const q = sp.q && quarters.includes(sp.q) ? sp.q : (allEv.find(e => e.status !== 'COMPLETED')?.quarter ?? quarters[0]);
  const evIds = allEv.filter(e => e.quarter === q).map(e => e.id);
  const ds = evIds.length ? await db.query.deals.findMany({ where: (d, o) => o.and(inArray(d.eventId, evIds), notInArray(d.status, ['REJECTED', 'WITHDRAWN', 'DRAFT'])), with: { vendor: true, event: true, lines: true } }) : [];
  const ps = evIds.length ? await db.query.promotions.findMany({ where: inArray(promotions.eventId, evIds), with: { brandVendor: true, event: true, lines: true } }) : [];
  type Row = { kind: 'deal' | 'promo'; id: string; number: string; who: string; name: string; event: string; start: string; end: string; md: number; vendor: number; wh: number; source: React.ReactNode; action?: React.ReactNode; upcs: number };
  const rows: Row[] = [
    ...ds.map(d => { const e = dealEcon({ lines: d.lines, startDate: d.startDate, endDate: d.endDate, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits });
      return { kind: 'deal' as const, id: d.id, number: d.number, who: d.vendor.name, name: d.title, event: d.event.name, start: d.startDate, end: d.endDate, md: e.markdown, vendor: e.vendorFunds, wh: e.whFunds, upcs: d.lines.length,
        source: <><span className="small">{DEAL_TYPE_LABEL[e.type]}</span><div><StatusPill s={d.status} auto={d.autoApproved} /></div></> }; }),
    ...ps.map(p => { const e = promoEcon(p.lines, p.event.startDate, p.event.endDate);
      return { kind: 'promo' as const, id: p.id, number: p.number, who: p.brandVendor?.name ?? 'Own brand / fresh', name: p.name, event: p.event.name, start: p.event.startDate, end: p.event.endDate, md: e.markdown, vendor: 0, wh: 0, upcs: p.lines.length,
        source: <><span className="small">No vendor contract</span><div className="small muted">{p.reason}{p.fundingRequested ? ' · funding requested' : ''}</div></>,
        action: p.brandVendor && !p.fundingRequested && can(me, 'add_retail_promos') ? <form action={requestFunding}><input type="hidden" name="id" value={p.id} /><button className="btn sm primary">Request funding</button></form> : undefined }; }),
  ].sort((a, b) => a.start < b.start ? -1 : 1);
  const cls = (x: Row) => classifyFunding(x.md, x.vendor + x.wh, r.fullFund).cls;
  const shown = sp.f ? rows.filter(x => cls(x) === sp.f) : rows;
  const md = rows.reduce((s, x) => s + x.md, 0), cov = rows.reduce((s, x) => s + Math.min(x.md, x.vendor + x.wh), 0);
  const count = (c: string) => rows.filter(x => cls(x) === c).length;
  return (
    <>
      <PageHead title="Promotions & funding" sub="Every promotion in the quarter, from vendor contracts or run by the retailer, and how much of its markdown vendors cover.">
        {can(me, 'add_retail_promos') && <Link className="btn primary" href="/promotions/new">Add retailer-funded promotion</Link>}
      </PageHead>
      <Flash sp={sp} />
      <div className="toolbar"><div className="seg">{quarters.map(x => <Link key={x} href={`/promotions?q=${encodeURIComponent(x)}`} aria-current={x === q ? 'true' : undefined}>{x}</Link>)}</div>
        <div className="seg">{['', 'Vendor funded', 'Shared', 'Retailer funded'].map(c => <Link key={c} href={`/promotions?q=${encodeURIComponent(q)}${c ? '&f=' + encodeURIComponent(c) : ''}`} aria-current={(sp.f ?? '') === c ? 'true' : undefined}>{c || 'All'} {c ? count(c) : rows.length}</Link>)}</div></div>
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Promotions</div><div className="v">{rows.length}</div><div className="s">{count('Vendor funded')} vendor · {count('Shared')} shared · {count('Retailer funded')} retailer</div></div>
        <div className="kpi"><div className="eyebrow">Markdown investment</div><div className="v">{kmoney(md)}</div><div className="s">(Regular − promo retail) × forecast units</div></div>
        <div className="kpi"><div className="eyebrow">Covered by vendors</div><div className="v">{kmoney(cov)}</div><div className="s">{pct(cov / Math.max(1, md))} of markdown</div></div>
        <div className="kpi"><div className="eyebrow">Carried by retailer</div><div className="v">{kmoney(md - cov)}</div></div>
      </div>
      <section className="panel"><div className="tbl"><table><thead><tr><th>Promotion</th><th>Event</th><th>Source</th><th className="num">Markdown</th><th className="num">Vendor $</th><th className="num">Retailer $</th><th>Mix</th><th>Funding</th><th></th></tr></thead><tbody>
        {shown.map(x => <tr key={x.id}>
          <td>{x.kind === 'deal' ? <Link className="id" href={`/deals/${x.id}`}>{x.number}</Link> : <span className="id">{x.number}</span>} <b>{x.who}</b><div className="small muted">{x.name} · {x.upcs} UPC{x.upcs === 1 ? '' : 's'}</div></td>
          <td className="small">{x.event}<div className="muted">{fdate(x.start)} – {fdate(x.end)}</div></td><td>{x.source}</td>
          <td className="num">{money(x.md)}</td><td className="num">{money(x.vendor + x.wh)}</td><td className="num">{money(Math.max(0, x.md - x.vendor - x.wh))}</td>
          <td>{x.md > 0 || x.vendor > 0 ? <MixBar vendor={x.vendor} wholesaler={x.wh} markdown={x.md} /> : null}</td><td><FundPill markdown={x.md} vendorFunds={x.vendor + x.wh} threshold={r.fullFund} /></td><td>{x.action}</td></tr>)}
      </tbody></table>{!shown.length && <Empty>No promotions match.</Empty>}</div></section>
      <p className="hint">Draft deals are excluded. Forecast units use each UPC’s baseline and the default lift curve until sales history is connected. Vendor funded means vendor money covers at least {pct(r.fullFund)} of the markdown.</p>
    </>
  );
}
