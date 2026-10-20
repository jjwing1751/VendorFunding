import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { dataUploads } from '@/db/schema';
import { can, isVendorUser, requireUser } from '@/lib/auth';
import { fdate, fdatetime, money, pct } from '@/lib/format';
import type { BillingStatus } from '@/lib/measure';
import { canMeasure, loadMeasured } from '@/lib/measure-data';
import { PageHead } from '@/components/ui';
import { BillPill } from '@/components/measure-ui';
import { UploadForm } from '@/components/UploadForm';
import { importBillBackManager } from '../data/actions';

const SHOW: BillingStatus[] = ['Ready to bill', 'Under-billed', 'Over-billed', 'Disputed', 'Billed in full', 'Collected', 'Running', 'Waiting for sales data', 'Off-invoice only'];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const me = await requireUser();
  if (isVendorUser(me) || !canMeasure(me)) return <PageHead title="Billing reconciliation" sub={`Your role (${me.role.name}) can’t see billing.`} />;
  const sp = await searchParams;
  const { measured } = await loadMeasured(me);
  const all = measured.filter(x => x.m.started).sort((a, b) => SHOW.indexOf(a.m.status) - SHOW.indexOf(b.m.status) || b.m.gap - a.m.gap);
  const list = sp.s ? all.filter(x => x.m.status === sp.s) : all;
  const ended = all.filter(x => x.m.ended);
  const sum = (xs: typeof all, f: (x: (typeof all)[number]) => number) => xs.reduce((s, x) => s + f(x), 0);
  const toBill = ended.filter(x => x.m.gap > Math.max(5, x.m.billable * 0.01));
  const over = ended.filter(x => x.m.status === 'Over-billed');
  const ups = await db.select().from(dataUploads).where(eq(dataUploads.kind, 'BILLING')).orderBy(desc(dataUploads.createdAt)).limit(8);
  const billing = can(me, 'manage_billing');
  return (
    <>
      <PageHead title="Billing reconciliation" sub="Billable vendor funding earned on approved deals, against what Bill Back Manager billed and collected.">
        {billing && <a className="btn primary" href="/api/export/ready-to-bill.csv">Export ready to bill ({toBill.length})</a>}
        <a className="btn" href="/api/export/reconciliation.csv">Download reconciliation</a>
      </PageHead>
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Billable earned</div><div className="v">{money(sum(ended, x => x.m.billable))}</div><div className="s">{ended.length} ended deals</div></div>
        <div className="kpi"><div className="eyebrow">Billed</div><div className="v">{money(sum(ended, x => x.m.billed))}</div><div className="s">{pct(sum(ended, x => x.m.billed) / Math.max(1, sum(ended, x => x.m.billable)))} of billable</div></div>
        <div className="kpi"><div className="eyebrow">Left to bill</div><div className="v" style={{ color: toBill.length ? 'var(--bad)' : undefined }}>{money(sum(toBill, x => x.m.gap))}</div><div className="s">{toBill.length} deal{toBill.length === 1 ? "" : "s"} ready or under-billed</div></div>
        <div className="kpi"><div className="eyebrow">Over-billed</div><div className="v">{money(-sum(over, x => x.m.gap))}</div><div className="s">{over.length} deal{over.length === 1 ? "" : "s"} to credit or explain</div></div>
        <div className="kpi"><div className="eyebrow">Open receivable</div><div className="v">{money(sum(all, x => x.m.open))}</div><div className="s">billed, not yet collected</div></div>
      </div>
      <div className="toolbar"><div className="seg">
        <Link href="/billing" aria-current={!sp.s ? 'true' : undefined}>All ({all.length})</Link>
        {SHOW.map(s => { const n = all.filter(x => x.m.status === s).length; return n ? <Link key={s} href={`/billing?s=${encodeURIComponent(s)}`} aria-current={sp.s === s ? 'true' : undefined}>{s} ({n})</Link> : null; })}
      </div></div>
      <section className="panel"><div className="tbl"><table><thead><tr>
        <th>Deal</th><th>Vendor · settlement</th><th>Ended</th><th className="num">Billable earned</th><th className="num">Billed</th><th className="num">Variance</th><th className="num">Collected</th><th>Status</th>
      </tr></thead><tbody>
        {list.map(({ d, m }) => <tr key={d.id}>
          <td><Link className="id" href={`/deals/${d.id}#funding`}>{d.number}</Link><div className="small">{d.title}</div></td>
          <td className="small">{d.vendor.name}<div className="muted">{d.vendor.settlement === 'DEDUCTION' ? 'Deduction' : 'Invoice'}</div></td>
          <td className="small">{m.ended ? fdate(d.endDate) : <span className="muted">runs to {fdate(d.endDate)}</span>}</td>
          <td className="num">{money(m.billable)}</td>
          <td className="num">{m.billed ? money(m.billed) : '—'}<div className="small muted">{m.bills.length ? `${m.bills.length} invoice${m.bills.length > 1 ? 's' : ''}` : ''}</div></td>
          <td className="num">{m.ended && Math.abs(m.gap) > 5 ? <b style={{ color: 'var(--bad)' }}>{m.gap > 0 ? `${money(m.gap)} under` : `${money(-m.gap)} over`}</b> : <span className="muted">—</span>}</td>
          <td className="num">{m.collected ? money(m.collected) : '—'}</td>
          <td><BillPill s={m.status} /></td>
        </tr>)}
        {!list.length && <tr><td colSpan={8} className="empty">No deals{sp.s ? ' with this status' : ''}.</td></tr>}
      </tbody></table></div>
        <div className="panel-b hint">A variance within 1% (or $5) counts as billed in full. Off-invoice allowances and wholesaler scans are not billed by the retailer, so they’re left out of billable.</div>
      </section>
      <div className="grid2">
        {billing && <section className="panel"><div className="panel-h"><h2>Import from Bill Back Manager</h2><a className="small" href="/api/export/template-bbm.csv">Template</a><a className="small" href="/api/export/sample-bbm.csv" title="A simulated Bill Back Manager file that bills everything ready to bill, for trying the round trip">Sample billing file</a></div><div className="panel-b">
          <UploadForm id="bbm" action={importBillBackManager} button="Import billing file" />
          <p className="hint" style={{ marginBottom: 0 }}>A CSV with one row per invoice or claim: the Fundline deal number, invoice or claim number, amount billed, and (optional) amount collected, invoice date, status and method. Re-importing an invoice number updates it. <b>Bill Back Manager’s exact export layout is still needed</b>; common header names are recognized until then.</p>
        </div></section>}
        <section className="panel"><div className="panel-h"><h2>Recent billing imports</h2></div><div className="list">
          {ups.map(u => <div className="li" key={u.id}><div className="grow"><div className="t">{u.fileName}</div><div className="d">{u.rows} invoices · {u.notes}{u.skipped ? ` · ${u.skipped} skipped` : ''} · {u.byName.split(' (')[0]}</div></div><span className="small muted">{fdatetime(u.createdAt)}</span></div>)}
          {!ups.length && <div className="empty">No billing files imported yet.</div>}
        </div></section>
      </div>
    </>
  );
}
