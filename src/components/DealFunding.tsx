import type { Me } from '@/lib/auth';
import { fdate, money, num, pct } from '@/lib/format';
import { accrualView } from '@/lib/measure';
import { canMeasure, loadMeasured } from '@/lib/measure-data';
import { AccrualPill, BillPill, FundingFunnel } from './measure-ui';

export async function DealFunding({ me, dealId }: { me: Me; dealId: string }) {
  if (!canMeasure(me)) return null;
  const { measured, today } = await loadMeasured(me, { dealIds: [dealId] });
  const x = measured[0]; if (!x) return null;
  const { m, d } = x;
  const acc = d.accrualPct > 0 ? accrualView(m, today) : null;
  return (
    <section className="panel" id="funding"><div className="panel-h"><h2>Funding to date</h2>{acc ? <AccrualPill s={acc.status} days={acc.daysToClaim} /> : <BillPill s={m.status} />}
      <span className="small muted">{!m.started ? `Starts ${fdate(d.startDate)}` : m.hasData ? `Sales data covers ${pct(m.coverage)} of the days run` : 'No sales data loaded for these UPCs yet'}</span></div>
      <div className="panel-b"><div className="grid2" style={{ gap: 24 }}>
        <FundingFunnel showTarget={false} committed={m.committed} earned={m.earned} billable={m.billable} billed={m.billed} collected={m.collected} />
        <div className="econ">
          <div><span className="eyebrow">Units: forecast → actual</span><b>{num(m.forecast)} → {m.actual == null ? '—' : num(m.actual)}</b></div>
          <div><span className="eyebrow">Off-invoice (on vendor invoice)</span><b>{money(m.offInvoice)}</b></div>
          <div><span className="eyebrow">Bill-back + scan</span><b>{money(m.billable - m.adEarned - m.accrual)}</b></div>
          <div><span className="eyebrow">Ad fee</span><b>{money(m.adEarned)}</b></div>
          {d.accrualPct > 0 && <div><span className="eyebrow">Accrual {pct(d.accrualPct, 1)} of {money(m.purchases)} purchases</span><b>{money(m.accrual)}</b></div>}
          <div><span className="eyebrow">Wholesaler scan (billed by wholesaler)</span><b>{money(m.wholesaler)}</b></div>
          <div><span className="eyebrow">Left to bill</span><b style={{ color: m.ended && m.gap > 5 ? 'var(--bad)' : undefined }}>{money(Math.max(0, m.gap))}</b></div>
          {acc && <div><span className="eyebrow">Claim by</span><b>{fdate(m.claimBy)}{acc.daysToClaim >= 0 ? ` (${acc.daysToClaim} days)` : ' (passed)'}</b></div>}
        </div>
      </div></div>
      {m.bills.length > 0 && <div className="tbl"><table><thead><tr><th>Bill Back Manager invoice / claim</th><th>Date</th><th>Method</th><th className="num">Billed</th><th className="num">Collected</th><th>Status</th></tr></thead><tbody>
        {m.bills.map((b, i) => { const r = b as typeof b & { invoiceNumber?: string; invoiceDate?: string | null; method?: string | null }; return <tr key={i}><td className="mono small">{r.invoiceNumber}</td><td className="small">{fdate(r.invoiceDate ?? null)}</td><td className="small">{r.method}</td><td className="num">{money(b.billed, 2)}</td><td className="num">{money(b.collected, 2)}</td><td><span className={`pill ${b.status === 'DISPUTED' ? 'bad' : ['PAID', 'DEDUCTED'].includes(b.status) ? 'good' : ''}`}>{b.status.toLowerCase().replace('_', ' ')}</span></td></tr>; })}
      </tbody></table></div>}
    </section>
  );
}
