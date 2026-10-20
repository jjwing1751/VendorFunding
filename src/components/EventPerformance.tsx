import Link from 'next/link';
import type { Me } from '@/lib/auth';
import { fdate, money, num, pct } from '@/lib/format';
import { measureEvent } from '@/lib/measure';
import { canMeasure, loadMeasured, seesTargets } from '@/lib/measure-data';
import { BillPill, FundingFunnel } from './measure-ui';

const Lift = ({ v }: { v: number | null }) => v == null ? <span className="muted">—</span> : <span className={v >= 0 ? 'delta-up' : 'delta-down'}>{v >= 0 ? '+' : ''}{pct(v)}</span>;

export async function EventPerformance({ me, e }: { me: Me; e: { id: string; startDate: string; endDate: string; fundingTarget: number; mediaBudget: number } }) {
  if (!canMeasure(me)) return null;
  const { measured, promos, A, today } = await loadMeasured(me, { eventIds: [e.id] });
  const p = measureEvent(e, measured.map(x => x.m), promos.filter(x => x.eventId === e.id), A, today);
  const targets = seesTargets(me);
  const upcs = measured.filter(x => x.m.type !== 'ACCR').flatMap(x => x.m.lines.map(l => ({ ...l, deal: x.d.number, dealId: x.d.id })));
  return (
    <section className="panel" id="performance"><div className="panel-h"><h2>Performance</h2><span className="small muted">{p.ended ? 'Completed' : p.started ? `Running · measured through ${fdate(today)}` : 'Not started; showing commitments'}</span></div>
      <div className="panel-b">
        <div className="grid2" style={{ gap: 24 }}>
          <FundingFunnel showTarget={targets} target={p.target} committed={p.committed} earned={p.earned} billable={p.billable} billed={p.billed} collected={p.collected} />
          <div className="econ">
            <div><span className="eyebrow">Baseline units{p.started && !p.ended ? ' to date' : ''}</span><b>{p.actual == null ? num(p.baseline) : num(p.baseToDate)}</b></div>
            <div><span className="eyebrow">Forecast lift</span><b><Lift v={p.forecastLift} /></b></div>
            <div><span className="eyebrow">Actual units</span><b>{p.actual == null ? '—' : num(p.actual)}</b></div>
            <div><span className="eyebrow">Actual lift</span><b><Lift v={p.actualLift} /></b></div>
            <div><span className="eyebrow">Forecast accuracy</span><b>{pct(p.accuracy)}</b></div>
            <div><span className="eyebrow">Promo gross margin</span><b>{p.promoGM == null ? '—' : money(p.promoGM)}</b></div>
            <div><span className="eyebrow">Incremental GM</span><b>{p.incGM == null ? '—' : money(p.incGM)}</b></div>
            <div><span className="eyebrow">Return on media</span><b>{p.mediaReturn == null ? '—' : `${p.mediaReturn.toFixed(2)}× on ${money(p.mediaBudget)}`}</b></div>
            <div><span className="eyebrow">Vendor $ per incremental unit</span><b>{p.vendorPerIncUnit == null ? '—' : money(p.vendorPerIncUnit, 2)}</b></div>
          </div>
        </div>
      </div>
      {measured.length > 0 && <div className="tbl"><table><thead><tr><th>Deal</th><th>Vendor</th><th className="num">Committed</th><th className="num">Earned</th><th className="num">Billable</th><th className="num">Billed</th><th className="num">Collected</th><th>Billing</th></tr></thead><tbody>
        {measured.map(({ d, m }) => <tr key={d.id}><td><Link className="id" href={`/deals/${d.id}`}>{d.number}</Link> <span className="small">{d.title}</span></td><td className="small">{d.vendor.name}</td>
          <td className="num">{money(m.committed)}</td><td className="num">{m.started ? money(m.earned) : '—'}</td><td className="num">{m.started ? money(m.billable) : '—'}</td><td className="num">{m.billed ? money(m.billed) : '—'}</td><td className="num">{m.collected ? money(m.collected) : '—'}</td><td><BillPill s={m.status} /></td></tr>)}
      </tbody></table></div>}
      {upcs.length > 0 && <details><summary className="panel-b small" style={{ cursor: 'pointer', fontWeight: 600 }}>Units by UPC ({upcs.length})</summary><div className="tbl"><table><thead><tr><th>UPC</th><th>Deal</th><th className="num">Baseline{p.ended ? '' : ' to date'}</th><th className="num">Forecast{p.ended ? '' : ' to date'}</th><th className="num">Actual</th><th className="num">Lift</th><th className="num">vs forecast</th></tr></thead><tbody>
        {upcs.map((l, i) => <tr key={i}><td className="mono small">{l.upc}</td><td><Link className="id" href={`/deals/${l.dealId}`}>{l.deal}</Link></td><td className="num">{num(l.baseToDate || l.baseline)}</td><td className="num">{num(l.forecastToDate || l.forecast)}</td><td className="num">{l.actual == null ? '—' : num(l.actual)}</td><td className="num"><Lift v={l.lift} /></td><td className="num">{l.actual == null || !l.forecastToDate ? '—' : pct(l.actual / l.forecastToDate)}</td></tr>)}
      </tbody></table></div></details>}
    </section>
  );
}
