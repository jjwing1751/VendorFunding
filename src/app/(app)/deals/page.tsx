import Link from 'next/link';
import { and, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { deals } from '@/db/schema';
import { can, inScope, isVendorUser, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { DEAL_TYPE_LABEL, evaluate } from '@/lib/economics';
import { fdate, money } from '@/lib/format';
import { Empty, Flash, FundPill, PageHead, StatusPill } from '@/components/ui';

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  review: { label: 'Needs review', statuses: ['SUBMITTED'] }, back: { label: 'Sent back', statuses: ['SENT_BACK'] }, draft: { label: 'Drafts', statuses: ['DRAFT'] },
  approved: { label: 'Approved', statuses: ['APPROVED'] }, closed: { label: 'Rejected / withdrawn', statuses: ['REJECTED', 'WITHDRAWN'] }, all: { label: 'All', statuses: [] },
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; ok?: string; error?: string; mine?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const vendor = isVendorUser(me);
  const key = sp.s && FILTERS[sp.s] ? sp.s : vendor ? 'all' : 'review';
  const where: SQL[] = [];
  if (vendor) where.push(eq(deals.vendorId, me.vendor!.id));
  if (FILTERS[key].statuses.length) where.push(inArray(deals.status, FILTERS[key].statuses as ('SUBMITTED')[]));
  if (sp.q) { const q = `%${sp.q.slice(0, 60)}%`; where.push(or(ilike(deals.number, q), ilike(deals.title, q))!); }
  const rows = await db.query.deals.findMany({ where: where.length ? and(...where) : undefined, with: { vendor: true, event: true, lines: true }, orderBy: [desc(deals.updatedAt)], limit: 200 });
  const scoped = !vendor && sp.mine === '1' ? rows.filter(d => inScope(me, d.vendor.category)) : rows;
  const { values: rules } = await currentRules();
  return (
    <>
      <PageHead title={vendor ? `${me.vendor!.name} deals` : 'Deal inbox'} sub={vendor ? 'Your CAISSP contracts with the retailer and where each one stands.' : 'Vendor CAISSP contracts, scored against the approval rules before you see them.'}>
        {(vendor ? can(me, 'submit_deals') : can(me, 'import_caissp')) && <><Link className="btn" href="/deals/import">Import CAISSP</Link><Link className="btn primary" href="/deals/new">New CAISSP deal</Link></>}
      </PageHead>
      <Flash sp={sp} />
      <form className="toolbar" method="get">
        <div className="seg">{Object.entries(FILTERS).map(([k, f]) => <Link key={k} href={`/deals?s=${k}${sp.q ? '&q=' + encodeURIComponent(sp.q) : ''}`} aria-current={k === key ? 'true' : undefined}>{f.label}</Link>)}</div>
        <input type="hidden" name="s" value={key} />
        <input className="inp" name="q" defaultValue={sp.q ?? ''} placeholder="Search deal number or title" style={{ maxWidth: 260 }} aria-label="Search deals" />
        {!vendor && !can(me, 'all_categories') && <label className="check"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === '1'} /> Only my categories</label>}
        <button className="btn sm">Filter</button>
      </form>
      <section className="panel"><div className="tbl"><table><thead><tr><th>Deal</th>{!vendor && <th>Vendor</th>}<th>Title / event</th><th>Type</th><th>Dates</th><th className="num">Vendor funding</th><th>Funding</th><th>Recommendation</th><th>Status</th></tr></thead><tbody>
        {scoped.map(d => {
          const ev = evaluate({ lines: d.lines, startDate: d.startDate, endDate: d.endDate, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits }, { rules, complianceScore: d.vendor.complianceScore, event: d.event, overlaps: [], unknownUpcs: [] });
          return <tr key={d.id}>
            <td><Link className="id" href={`/deals/${d.id}`}>{d.number}</Link></td>
            {!vendor && <td><b>{d.vendor.name}</b><div className="small muted">{d.vendor.category}{inScope(me, d.vendor.category) ? '' : ' · not yours'}</div></td>}
            <td><Link className="rowlink" href={`/deals/${d.id}`}>{d.title}</Link><div className="small muted">{d.event.name} · {d.lines.length} UPC{d.lines.length === 1 ? '' : 's'}</div></td>
            <td className="small">{DEAL_TYPE_LABEL[ev.econ.type]}</td><td className="small">{fdate(d.startDate)} – {fdate(d.endDate)}</td>
            <td className="num">{money(ev.econ.totalFunds)}</td><td><FundPill markdown={ev.econ.markdown} vendorFunds={ev.econ.totalFunds} threshold={rules.fullFund} /></td>
            <td>{['SUBMITTED', 'SENT_BACK', 'DRAFT'].includes(d.status) ? <span className={`pill ${ev.rec === 'Approve' ? 'good' : ev.rec === 'Counter' ? 'warn' : ev.rec === 'Reject' ? 'bad' : 'info'}`}>{ev.rec}</span> : <span className="muted">—</span>}</td>
            <td><StatusPill s={d.status} auto={d.autoApproved} /></td></tr>;
        })}
      </tbody></table>{!scoped.length && <Empty>No deals match.</Empty>}</div></section>
    </>
  );
}
