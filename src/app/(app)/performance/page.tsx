import Link from 'next/link';
import { isVendorUser, requireUser } from '@/lib/auth';
import { fdate, money, pct } from '@/lib/format';
import { measureEvent } from '@/lib/measure';
import { canMeasure, dataCoverage, eventsForWindow, loadMeasured, seesTargets } from '@/lib/measure-data';
import { PageHead } from '@/components/ui';
import { Definitions, FundingFunnel } from '@/components/measure-ui';

const WINDOWS: Record<string, string> = { recent: 'Last 6 months and upcoming', past: 'Completed events', all: 'All events' };
const Lift = ({ v }: { v: number | null }) => v == null ? <span className="muted">—</span> : <span>{v >= 0 ? '+' : ''}{pct(v)}</span>;

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const me = await requireUser();
  if (isVendorUser(me) || !canMeasure(me)) return <PageHead title="Funding & performance" sub={`Your role (${me.role.name}) can’t see funding and performance.`} />;
  const sp = await searchParams;
  const w = sp.w && WINDOWS[sp.w] ? sp.w : 'recent';
  const evs = await eventsForWindow(w);
  const { measured, promos, A, today } = await loadMeasured(me, { eventIds: evs.map(e => e.id) });
  const cov = await dataCoverage();
  const targets = seesTargets(me);
  const rows = evs.map(e => {
    const ms = measured.filter(x => x.d.eventId === e.id).map(x => x.m);
    const pr = promos.filter(p => p.eventId === e.id);
    return { e, n: ms.length, p: measureEvent(e, ms, pr, A, today) };
  });
  const tot = rows.reduce((s, r) => ({ target: s.target + r.p.target, committed: s.committed + r.p.committed, earned: s.earned + r.p.earned, billable: s.billable + r.p.billable, billed: s.billed + r.p.billed, collected: s.collected + r.p.collected }), { target: 0, committed: 0, earned: 0, billable: 0, billed: 0, collected: 0 });
  const done = rows.filter(r => r.p.ended);
  const unbilled = measured.filter(x => x.m.ended && x.d.eventId && evs.some(e => e.id === x.d.eventId)).reduce((s, x) => s + Math.max(0, x.m.gap), 0);
  return (
    <>
      <PageHead title="Funding & performance" sub={`What vendors committed, earned and were billed, against the event targets, and how each event performed.${targets ? '' : ' Showing your categories only; event targets need all-category access.'}`}>
        <div className="seg">{Object.entries(WINDOWS).map(([k, l]) => <Link key={k} href={`/performance?w=${k}`} aria-current={k === w ? 'true' : undefined}>{l}</Link>)}</div>
      </PageHead>
      <p className="hint" style={{ marginTop: -6 }}>Sales data through {cov.sales.through ? fdate(cov.sales.through) : <b>none loaded</b>} · receipts through {cov.receipts.through ? fdate(cov.receipts.through) : <b>none loaded</b>} · {cov.billing.n} Bill Back Manager records{cov.billing.last ? `, last import ${fdate(cov.billing.last)}` : ''}. <Link href="/data">Upload data</Link></p>
      <div className="kpis">
        {targets && <div className="kpi"><div className="eyebrow">Target</div><div className="v">{money(tot.target)}</div><div className="s">{rows.length} events</div></div>}
        <div className="kpi"><div className="eyebrow">Committed</div><div className="v">{money(tot.committed)}</div><div className="s">{targets && tot.target ? `${pct(tot.committed / tot.target)} of target` : `${measured.length} approved deals`}</div></div>
        <div className="kpi"><div className="eyebrow">Earned to date</div><div className="v">{money(tot.earned)}</div><div className="s">{money(tot.billable)} billable by us</div></div>
        <div className="kpi"><div className="eyebrow">Billed</div><div className="v">{money(tot.billed)}</div><div className="s">{tot.billable ? `${pct(tot.billed / tot.billable)} of billable` : '—'} · {money(unbilled)} not yet billed</div></div>
        <div className="kpi"><div className="eyebrow">Collected</div><div className="v">{money(tot.collected)}</div><div className="s">{tot.billed ? `${pct(tot.collected / tot.billed)} of billed` : '—'}</div></div>
      </div>
      <div className="grid2">
        <section className="panel"><div className="panel-h"><h2>Funding funnel</h2><span className="small muted">{WINDOWS[w]}</span></div><div className="panel-b">
          <FundingFunnel showTarget={targets} target={tot.target} committed={tot.committed} earned={tot.earned} billable={tot.billable} billed={tot.billed} collected={tot.collected} />
        </div></section>
        <section className="panel"><div className="panel-h"><h2>Completed events</h2><span className="small muted">{done.length} in view</span></div><div className="panel-b">
          {done.length ? <div className="econ">
            <div><span className="eyebrow">Units vs baseline</span><b><Lift v={sumLift(done)} /></b></div>
            <div><span className="eyebrow">Forecast accuracy</span><b>{pct(acc(done))}</b></div>
            <div><span className="eyebrow">Incremental GM</span><b>{money(done.reduce((s, r) => s + (r.p.incGM ?? 0), 0))}</b></div>
            <div><span className="eyebrow">Media spend</span><b>{money(done.reduce((s, r) => s + r.p.mediaBudget, 0))}</b></div>
            <div><span className="eyebrow">Return on media</span><b>{ratio(done)}</b></div>
            <div><span className="eyebrow">Collected vs target</span><b>{targets ? pct(done.reduce((s, r) => s + r.p.collected, 0) / Math.max(1, done.reduce((s, r) => s + r.p.target, 0))) : '—'}</b></div>
          </div> : <p className="muted" style={{ margin: 0 }}>No completed events in this view yet.</p>}
        </div></section>
      </div>
      <section className="panel"><div className="panel-h"><h2>By event</h2></div><div className="tbl"><table><thead><tr>
        <th>Event</th>{targets && <th className="num">Target</th>}<th className="num">Committed</th><th className="num">Earned</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">Lift (forecast → actual)</th><th className="num">Accuracy</th><th className="num">Incr. GM</th><th className="num">Return on media</th>
      </tr></thead><tbody>
        {rows.map(({ e, n, p }) => <tr key={e.id}>
          <td><Link className="rowlink" href={`/events/${e.id}#performance`}>{e.name}</Link><div className="small muted">{fdate(e.startDate)} – {fdate(e.endDate)} · {n} deal{n === 1 ? '' : 's'} · {p.ended ? 'completed' : p.started ? 'running' : 'upcoming'}</div></td>
          {targets && <td className="num">{money(p.target)}<div className="small muted">{p.target ? pct(p.committed / p.target) + ' committed' : ''}</div></td>}
          <td className="num">{money(p.committed)}</td>
          <td className="num">{p.started ? money(p.earned) : <span className="muted">—</span>}</td>
          <td className="num">{p.billed ? money(p.billed) : <span className="muted">—</span>}{p.billable > 0 && p.ended ? <div className="small muted">{pct(p.billed / p.billable)} of billable</div> : null}</td>
          <td className="num">{p.collected ? money(p.collected) : <span className="muted">—</span>}</td>
          <td className="num"><Lift v={p.forecastLift} /> → <Lift v={p.actualLift} /></td>
          <td className="num">{pct(p.accuracy)}</td>
          <td className="num">{p.incGM == null ? <span className="muted">—</span> : money(p.incGM)}</td>
          <td className="num">{p.mediaReturn == null ? <span className="muted">—</span> : `${p.mediaReturn.toFixed(2)}×`}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan={10} className="empty">No events in this view.</td></tr>}
      </tbody></table></div>
        <div className="panel-b hint">Lift and margin need sales data for the event’s UPCs; “—” means none is loaded yet. Accrual deals count toward funding but not lift.</div>
      </section>
      <Definitions />
    </>
  );
}

type R = { p: { actual: number | null; baseToDate: number; accuracy: number | null; forecast: number; incGM: number | null; mediaBudget: number } };
function sumLift(rs: R[]) { const a = rs.filter(r => r.p.actual != null); const b = a.reduce((s, r) => s + r.p.baseToDate, 0); return b ? a.reduce((s, r) => s + (r.p.actual ?? 0), 0) / b - 1 : null; }
function acc(rs: R[]) { const a = rs.filter(r => r.p.accuracy != null && r.p.actual != null); const f = a.reduce((s, r) => s + (r.p.actual ?? 0) / (r.p.accuracy || 1), 0); return f ? a.reduce((s, r) => s + (r.p.actual ?? 0), 0) / f : null; }
function ratio(rs: R[]) { const m = rs.filter(r => r.p.incGM != null).reduce((s, r) => s + r.p.mediaBudget, 0); return m ? `${(rs.reduce((s, r) => s + (r.p.incGM ?? 0), 0) / m).toFixed(2)}×` : '—'; }
