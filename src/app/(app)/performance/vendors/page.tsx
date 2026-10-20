import Link from 'next/link';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { deals } from '@/db/schema';
import { isVendorUser, requireUser } from '@/lib/auth';
import { addDays, money, pct } from '@/lib/format';
import { scorecard } from '@/lib/measure';
import { canMeasure, loadMeasured, seesVendorDeal, vendorList } from '@/lib/measure-data';
import { PageHead } from '@/components/ui';
import { BillPill, FundingFunnel } from '@/components/measure-ui';

const P = ({ v, good = 0.9, warn = 0.75 }: { v: number | null; good?: number; warn?: number }) => v == null ? <span className="muted">—</span> : <span className={`pill ${v >= good ? 'good' : v >= warn ? 'warn' : 'bad'}`}>{pct(v)}</span>;
const Lift = ({ v }: { v: number | null }) => v == null ? <span className="muted">—</span> : <span>{v >= 0 ? '+' : ''}{pct(v)}</span>;

export default async function ScorecardPage() {
  const me = await requireUser();
  if (!canMeasure(me)) return <PageHead title="Vendor scorecards" sub={`Your role (${me.role.name}) can’t see scorecards.`} />;
  const vendor = isVendorUser(me);
  const { measured, rules } = await loadMeasured(me, vendor ? { vendorId: me.vendor!.id } : {});
  const vs = (await vendorList(me)).filter(v => !vendor || v.id === me.vendor!.id);
  const all = (await db.query.deals.findMany({ where: inArray(deals.vendorId, vs.map(v => v.id).concat('-')), with: { event: true, vendor: true } })).filter(d => seesVendorDeal(me, d.vendor));
  const cards = vs.map(v => {
    const ds = all.filter(d => d.vendorId === v.id).map(d => ({ status: d.status, submittedAt: d.submittedAt, autoApproved: d.autoApproved, cutoff: addDays(d.event.startDate, -rules.cutoffDays) }));
    const ms = measured.filter(x => x.d.vendorId === v.id);
    return { v, ms, s: scorecard(ds, ms.map(x => x.m), v.complianceScore) };
  }).filter(c => c.s.submitted > 0 || c.ms.length > 0).sort((a, b) => b.s.committed - a.s.committed);

  if (vendor) {
    const c = cards[0];
    return (
      <>
        <PageHead title={`${me.vendor!.name} scorecard`} sub="How the retailer sees your funding: what you committed, what was earned on actual sales, what was billed and collected, and how your promotions performed." />
        {!c ? <section className="panel"><div className="empty">No approved deals yet.</div></section> : <>
          <div className="kpis">
            <div className="kpi"><div className="eyebrow">Approval rate</div><div className="v">{pct(c.s.approvalRate)}</div><div className="s">{c.s.approved} of {c.s.submitted} submitted · {pct(c.s.autoRate)} automatic</div></div>
            <div className="kpi"><div className="eyebrow">On time</div><div className="v">{pct(c.s.onTimeRate)}</div><div className="s">submitted by the deal cutoff</div></div>
            <div className="kpi"><div className="eyebrow">Lift delivered</div><div className="v"><Lift v={c.s.liftDelivered} /></div><div className="s">{pct(c.s.accuracy)} of forecast units</div></div>
            <div className="kpi"><div className="eyebrow">Compliance score</div><div className="v">{c.s.complianceScore.toFixed(2)}</div><div className="s">rule minimum {rules.minScore.toFixed(2)}</div></div>
          </div>
          <section className="panel"><div className="panel-h"><h2>Funding</h2></div><div className="panel-b"><FundingFunnel showTarget={false} committed={c.s.committed} earned={c.s.earned} billable={c.s.billable} billed={c.s.billed} collected={c.s.collected} /></div></section>
          <section className="panel"><div className="panel-h"><h2>Approved deals</h2></div><div className="tbl"><table><thead><tr><th>Deal</th><th className="num">Committed</th><th className="num">Earned</th><th className="num">Billed</th><th className="num">Collected</th><th>Billing</th></tr></thead><tbody>
            {c.ms.map(({ d, m }) => <tr key={d.id}><td><Link className="id" href={`/deals/${d.id}#funding`}>{d.number}</Link> <span className="small">{d.title}</span></td><td className="num">{money(m.committed)}</td><td className="num">{m.started ? money(m.earned) : '—'}</td><td className="num">{m.billed ? money(m.billed) : '—'}</td><td className="num">{m.collected ? money(m.collected) : '—'}</td><td><BillPill s={m.status} /></td></tr>)}
          </tbody></table></div></section>
        </>}
      </>
    );
  }
  return (
    <>
      <PageHead title="Vendor scorecards" sub="Funding, billing, timeliness and delivered lift for every vendor with deals in your categories." />
      <section className="panel"><div className="tbl"><table><thead><tr>
        <th>Vendor</th><th className="num">Committed</th><th className="num">Earned</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">Unbilled</th><th>Collection</th><th>Share of markdown</th><th>On time</th><th>Approved / auto</th><th className="num">Lift delivered</th><th>vs forecast</th><th className="num">Compliance</th>
      </tr></thead><tbody>
        {cards.map(({ v, s }) => <tr key={v.id}>
          <td><b>{v.name}</b><div className="small muted">{v.category} · {s.approved} approved deal{s.approved === 1 ? '' : 's'}</div></td>
          <td className="num">{money(s.committed)}</td><td className="num">{money(s.earned)}</td><td className="num">{s.billed ? money(s.billed) : '—'}</td><td className="num">{s.collected ? money(s.collected) : '—'}</td>
          <td className="num">{s.unbilled > 5 ? <b style={{ color: 'var(--bad)' }}>{money(s.unbilled)}</b> : '—'}</td>
          <td><P v={s.collectionRate} /></td>
          <td><P v={s.fundingShare} good={rules.fullFund} warn={rules.minCov} /></td>
          <td><P v={s.onTimeRate} /></td>
          <td className="small">{pct(s.approvalRate)} / {pct(s.autoRate)}</td>
          <td className="num"><Lift v={s.liftDelivered} /></td>
          <td><P v={s.accuracy} good={0.9} warn={0.7} /></td>
          <td className="num">{v.complianceScore.toFixed(2)}</td>
        </tr>)}
        {!cards.length && <tr><td colSpan={13} className="empty">No vendor deals yet.</td></tr>}
      </tbody></table></div>
        <div className="panel-b hint">Share of markdown: vendor and wholesaler funding ÷ markdown on approved promotional deals (green at the vendor-funded threshold, {pct(rules.fullFund)}). On time: submitted by the event’s deal cutoff. Lift delivered and vs forecast use ended deals with sales data.</div>
      </section>
    </>
  );
}
