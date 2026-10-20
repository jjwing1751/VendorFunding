import Link from 'next/link';
import { isVendorUser, requireUser } from '@/lib/auth';
import { fdate, money, pct } from '@/lib/format';
import { accrualView, type AccrualStatus } from '@/lib/measure';
import { canMeasure, dataCoverage, loadMeasured } from '@/lib/measure-data';
import { PageHead } from '@/components/ui';
import { AccrualPill } from '@/components/measure-ui';

const ORDER: AccrualStatus[] = ['Expired unbilled', 'Expiring', 'Ready to bill', 'Earning', 'Not started', 'Fully billed'];

export default async function AccrualsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const me = await requireUser();
  if (!canMeasure(me)) return <PageHead title="Accruals" sub={`Your role (${me.role.name}) can’t see accruals.`} />;
  const sp = await searchParams;
  const { measured, today, rules } = await loadMeasured(me);
  const cov = await dataCoverage();
  const all = measured.filter(x => x.d.accrualPct > 0).map(x => ({ ...x, a: accrualView(x.m, today) }))
    .sort((p, q) => ORDER.indexOf(p.a.status) - ORDER.indexOf(q.a.status) || p.m.claimBy.localeCompare(q.m.claimBy));
  const list = sp.s ? all.filter(x => x.a.status === sp.s) : all;
  const sum = (f: (x: (typeof all)[number]) => number) => all.reduce((s, x) => s + f(x), 0);
  const atRisk = all.filter(x => x.a.status === 'Expiring' || x.a.status === 'Expired unbilled');
  const vendor = isVendorUser(me);
  return (
    <>
      <PageHead title={vendor ? `${me.vendor!.name} accruals` : 'Accruals'} sub={`Accrual deals earn a percentage of purchases received over the deal period. Earned balances must be billed within ${rules.claimDays} days after the deal ends.`} />
      <p className="hint" style={{ marginTop: -6 }}>Receipts loaded through {cov.receipts.through ? fdate(cov.receipts.through) : <b>none yet</b>}; earnings after that date aren’t counted until the next upload.</p>
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Committed</div><div className="v">{money(sum(x => x.m.committedAccrual))}</div><div className="s">{all.length} accrual deals, at forecast purchases</div></div>
        <div className="kpi"><div className="eyebrow">Earned to date</div><div className="v">{money(sum(x => x.m.accrual))}</div><div className="s">on {money(sum(x => x.m.purchases))} purchases</div></div>
        <div className="kpi"><div className="eyebrow">Billed</div><div className="v">{money(sum(x => x.m.billed))}</div><div className="s">{money(sum(x => x.m.collected))} collected</div></div>
        <div className="kpi"><div className="eyebrow">Unbilled balance</div><div className="v">{money(sum(x => x.a.balance))}</div><div className="s">earned, not yet billed</div></div>
        <div className="kpi"><div className="eyebrow">At risk</div><div className="v" style={{ color: atRisk.length ? 'var(--bad)' : undefined }}>{money(atRisk.reduce((s, x) => s + x.a.balance, 0))}</div><div className="s">{atRisk.length} expiring or past the claim window</div></div>
      </div>
      <div className="toolbar"><div className="seg">
        <Link href="/accruals" aria-current={!sp.s ? 'true' : undefined}>All ({all.length})</Link>
        {ORDER.map(s => { const n = all.filter(x => x.a.status === s).length; return n ? <Link key={s} href={`/accruals?s=${encodeURIComponent(s)}`} aria-current={sp.s === s ? 'true' : undefined}>{s} ({n})</Link> : null; })}
      </div></div>
      <section className="panel"><div className="tbl"><table><thead><tr>
        <th>Deal</th>{!vendor && <th>Vendor</th>}<th>Rate · period</th><th className="num">Purchases</th><th className="num">Earned</th><th>vs committed</th><th className="num">Billed</th><th className="num">Balance</th><th>Claim by</th><th>Status</th>
      </tr></thead><tbody>
        {list.map(({ d, m, a }) => <tr key={d.id}>
          <td><Link className="id" href={`/deals/${d.id}#funding`}>{d.number}</Link><div className="small">{d.title}</div></td>
          {!vendor && <td className="small">{d.vendor.name}</td>}
          <td className="small">{pct(d.accrualPct, 1)} of purchases<div className="muted">{fdate(d.startDate)} – {fdate(d.endDate)} · {d.lines.length} UPC{d.lines.length === 1 ? '' : 's'}</div></td>
          <td className="num">{money(m.purchases)}</td>
          <td className="num">{money(m.accrual)}</td>
          <td style={{ minWidth: 140 }}><div className={`meter ${a.pace != null && a.pace < 0.85 ? 'warn' : ''}`} title={`${pct(a.pctOfCommit)} of ${money(m.committedAccrual)} committed`}><i style={{ width: `${Math.min(100, (a.pctOfCommit ?? 0) * 100)}%` }} /></div>
            <div className="small muted">{pct(a.pctOfCommit)} of {money(m.committedAccrual)}{a.pace != null && !m.ended ? ` · pace ${pct(a.pace)}` : ''}</div></td>
          <td className="num">{m.billed ? money(m.billed) : '—'}</td>
          <td className="num"><b style={{ color: a.balance > 5 && (a.status === 'Expiring' || a.status === 'Expired unbilled') ? 'var(--bad)' : undefined }}>{money(a.balance)}</b></td>
          <td className="small">{fdate(m.claimBy)}<div className="muted">{a.daysToClaim >= 0 ? `${a.daysToClaim} days left` : `${-a.daysToClaim} days ago`}</div></td>
          <td><AccrualPill s={a.status} days={a.daysToClaim} /></td>
        </tr>)}
        {!list.length && <tr><td colSpan={10} className="empty">No accrual deals{sp.s ? ' with this status' : ''}.</td></tr>}
      </tbody></table></div>
        <div className="panel-b hint">Pace compares earnings so far with the committed amount for the share of the period that has run. Under 85% is flagged. Enter an accrual on a CAISSP deal with the Accrual % field.</div>
      </section>
    </>
  );
}
