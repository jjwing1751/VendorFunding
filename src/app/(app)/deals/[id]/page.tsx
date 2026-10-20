import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog } from '@/db/schema';
import { can, inScope, isVendorUser, requireUser } from '@/lib/auth';
import { evaluateDeal, loadDeal } from '@/lib/data';
import { classifyFunding, DEAL_TYPE_LABEL, lineCalc } from '@/lib/economics';
import { fdate, fdateY, fdatetime, money, num, pct } from '@/lib/format';
import { Flash, FundPill, MixBar, PageHead, StatusPill } from '@/components/ui';
import { DealFunding } from '@/components/DealFunding';
import { acceptCounter, addComment, decideDeal, submitDeal, withdrawDeal } from '../actions';

const PERIOD_LABEL: Record<string, string> = { amap: 'CMAP / AMAP off-invoice', tpr: 'TPR off-invoice', ad: 'Ad off-invoice', bb: 'Bill-back', wscan: 'Wholesaler unit scan', rscan: 'Unit scan' };
const HEADER_LABEL: Record<string, string> = { vendorNumber: 'Vendor number', broker: 'Vendor / broker', salesperson: 'Salesperson', phone: 'Phone', email: 'Email', datePresented: 'Date presented', promotion: 'Promotion', adRunDates: 'Ad run dates', aimContract: 'AIM contract #', billingCompany: 'Billing company', billingContact: 'Billing contact', billingEmail: 'Billing email', feature: 'Feature' };

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  const d = await loadDeal((await params).id);
  const vendorUser = isVendorUser(me);
  if (!d || (vendorUser && me.vendor?.id !== d.vendorId)) notFound();
  const sp = await searchParams;
  const ev = await evaluateDeal(d);
  const e = ev.econ, r = ev.rules;
  const fund = classifyFunding(e.markdown, e.totalFunds, r.fullFund);
  const trail = await db.select().from(auditLog).where(and(eq(auditLog.objectType, 'deal'), eq(auditLog.objectId, d.number))).orderBy(asc(auditLog.seq));
  const open = ['DRAFT', 'SUBMITTED', 'SENT_BACK'].includes(d.status);
  const editable = ['DRAFT', 'SENT_BACK'].includes(d.status) && (vendorUser ? can(me, 'submit_deals') : can(me, 'import_caissp') && d.createdById === me.user.id);
  const decider = !vendorUser && can(me, 'approve_deals') && d.status === 'SUBMITTED';
  const blockReason = !decider ? null : !inScope(me, d.vendor.category) ? `${d.vendor.category} is not one of your assigned categories.` : d.createdById === me.user.id ? 'You entered this deal, so another approver has to decide (segregation of duties).' : null;
  const overCap = e.totalFunds > r.maxAuto && !can(me, 'approve_over_cap');
  const visibleComments = d.comments.filter(c => !c.internal || !vendorUser);
  const tone = { Approve: 'good', Counter: 'warn', Review: 'info', Reject: 'bad' }[ev.rec];

  return (
    <>
      <PageHead title={`${d.number} · ${d.title}`} sub={<>{d.vendor.name} · {d.event.name} · {fdate(d.startDate)} – {fdate(d.endDate)} · version {d.version} · <StatusPill s={d.status} auto={d.autoApproved} /></>}>
        {editable && <Link className="btn" href={`/deals/${d.id}/edit`}>Edit</Link>}
        {open && (vendorUser ? can(me, 'submit_deals') : d.createdById === me.user.id) && <form action={withdrawDeal}><input type="hidden" name="id" value={d.id} /><button className="btn bad">Withdraw</button></form>}
      </PageHead>
      <Flash sp={sp} />

      {open && <div className={`callout ${ev.rec}`}>
        <div className="eyebrow">{d.status === 'DRAFT' ? 'Pre-check' : 'System recommendation'} · score {ev.score}/100 · rules v{ev.ruleVersion}</div>
        <h2 style={{ margin: '2px 0 4px' }}>{ev.rec === 'Counter' && ev.counterRate ? `Counter at about $${ev.counterRate.toFixed(2)} per unit` : ev.rec === 'Approve' ? (r.autoApprove ? 'Passes every rule; approves automatically on submit' : 'Passes every rule') : ev.rec}</h2>
        <div>{ev.reason}</div>
      </div>}
      {d.status === 'SENT_BACK' && <div className="callout Counter"><b>Sent back by {d.decidedByName}{d.counterRate ? ` with a $${d.counterRate.toFixed(2)}/unit counter` : ''}.</b> {d.decisionNote}</div>}
      {['APPROVED', 'REJECTED'].includes(d.status) && <div className={`callout ${d.status === 'APPROVED' ? 'Approve' : 'Reject'}`}><b>{d.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {d.decidedByName}</b> on {fdatetime(d.decidedAt)}{d.ruleVersion ? ` under rules v${d.ruleVersion}` : ''}. {d.decisionNote}</div>}

      {d.status === 'APPROVED' && <DealFunding me={me} dealId={d.id} />}

      <div className="grid-main">
        <div>
          <section className="panel"><div className="panel-h"><h2>Economics</h2><span className="pill">{DEAL_TYPE_LABEL[e.type]}</span></div><div className="panel-b"><div className="econ">
            <div><span className="eyebrow">Cost → net cost</span><b>${e.cost.toFixed(2)} → ${e.netCost.toFixed(2)}</b></div>
            <div><span className="eyebrow">Retail → promo</span><b>${e.retail.toFixed(2)} → ${e.promo.toFixed(2)}</b></div>
            <div><span className="eyebrow">Promo gross margin</span><b>{pct(e.promoGM, 1)}</b></div>
            <div><span className="eyebrow">Baseline units</span><b>{num(e.baseUnits)}</b></div>
            <div><span className="eyebrow">Forecast units</span><b>{num(e.planUnits)}</b></div>
            <div><span className="eyebrow">Forecast lift</span><b>{pct(e.lift)}</b></div>
            <div><span className="eyebrow">Vendor funding</span><b style={{ color: 'var(--money)' }}>{money(e.totalFunds)}</b></div>
            <div><span className="eyebrow">Markdown cost</span><b>{money(e.markdown)}</b></div>
            <div><span className="eyebrow">Incremental GM</span><b style={{ color: e.incGM >= 0 ? 'var(--good)' : 'var(--bad)' }}>{money(e.incGM)}</b></div>
          </div><p className="hint" style={{ marginBottom: 0 }}>Weighted by each UPC’s baseline weekly units. Forecast uses the default lift curve until sales history is connected.</p></div></section>

          <section className="panel"><div className="panel-h"><h2>CAISSP · UPC lines</h2><span className="pill">{d.lines.length}</span>{d.imported && <span className="pill acc">Imported</span>}</div>
            <div className="tbl"><table className="lines"><thead><tr><th>UPC</th><th>Description</th><th className="num">Pack</th><th className="num">Case cost</th><th className="num">Total OI</th><th className="num">Bill-back</th><th className="num">Whsl scan</th><th className="num">Unit scan</th><th className="num">Deal case</th><th className="num">Net unit</th><th className="num">Reg</th><th className="num">Promo</th><th className="num">GM</th><th>Funded</th></tr></thead><tbody>
              {d.lines.map(l => { const c = lineCalc(l); return <tr key={l.id}>
                <td><Link className="id" href={`/items/${encodeURIComponent(l.upc)}`}>{l.upc}</Link></td><td>{l.description}</td><td className="num">{l.casePack}</td><td className="num">${l.caseCost.toFixed(2)}</td>
                <td className="num">${c.totOI.toFixed(2)}</td><td className="num">${l.billBack.toFixed(2)}</td><td className="num">${l.wholesalerScan.toFixed(2)}</td><td className="num">${l.retailerScan.toFixed(2)}</td>
                <td className="num">${c.dealCaseCost.toFixed(2)}</td><td className="num">${c.netUnitCost.toFixed(2)}</td><td className="num">${l.regularRetail.toFixed(2)}</td><td className="num">${c.promo.toFixed(2)}</td><td className="num">{pct(c.promoGM)}</td>
                <td>{c.share == null ? '—' : <span className={`pill ${c.share >= r.fullFund ? 'good' : c.share > 0 ? 'warn' : ''}`}>{pct(c.share)}</span>}</td></tr>; })}
            </tbody></table></div></section>

          <section className="panel"><div className="panel-h"><h2>Contract details</h2></div><div className="panel-b">
            <dl className="kv">{Object.entries(d.header).filter(([, v]) => v).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{HEADER_LABEL[k] ?? k}</dt><dd>{String(v)}</dd></div>)}
              <dt>Store groups</dt><dd>{d.storeGroups.join(', ') || '—'}</dd><dt>Ad fee / lump sum</dt><dd className="mono">{money(d.adFee)}</dd>{d.accrualPct > 0 && <><dt>Accrual</dt><dd className="mono">{pct(d.accrualPct, 1)} of purchases</dd></>}
              <dt>Authorized signer</dt><dd>{d.signer ?? '—'}{d.submittedAt ? ` · submitted ${fdateY(d.submittedAt)}` : ''}</dd></dl>
            {Object.keys(d.periods).length > 0 && <div className="tbl" style={{ marginTop: 12 }}><table><thead><tr><th>Allowance</th><th>Start</th><th>End</th></tr></thead><tbody>{Object.entries(d.periods).map(([k, p]) => <tr key={k}><td>{PERIOD_LABEL[k] ?? k}</td><td className="mono small">{p?.start}</td><td className="mono small">{p?.end}</td></tr>)}</tbody></table></div>}
          </div></section>

          <section className="panel" id="comments"><div className="panel-h"><h2>Conversation</h2></div>
            <div className="list">{visibleComments.map(c => <div className="li" key={c.id}><div className="grow"><div className="t small">{c.authorName} <span className="muted">· {fdatetime(c.createdAt)}</span>{c.internal && <span className="pill" style={{ marginLeft: 6 }}>Internal</span>}</div><div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div></div></div>)}{!visibleComments.length && <div className="empty small">No comments yet.</div>}</div>
            <form action={addComment} className="panel-b form" style={{ borderTop: '1px solid var(--line)' }}>
              <input type="hidden" name="id" value={d.id} />
              <div className="field"><label htmlFor="body">Add a comment</label><textarea id="body" name="body" maxLength={2000} required /></div>
              <div className="actions">{!vendorUser && <label className="check"><input type="checkbox" name="internal" /> Internal note (vendors can’t see it)</label>}<button className="btn">Post</button></div>
            </form></section>
        </div>

        <div>
          {decider && <section className="panel"><div className="panel-h"><h2>Decision</h2></div><div className="panel-b form">
            {blockReason ? <p className="err" style={{ margin: 0 }}>{blockReason}</p> : <>
              <form action={decideDeal} className="form"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="decision" value="approve" />
                <div className="field"><label htmlFor="anote">Approval note (optional)</label><input id="anote" name="note" maxLength={300} /></div>
                {overCap ? <p className="err small" style={{ margin: 0 }}>Above the {money(r.maxAuto)} cap: a category director has to approve.</p> : <div><button className="btn good">Approve</button></div>}</form>
              <form action={decideDeal} className="form" style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="decision" value="counter" />
                <div className="fgrid"><div className="field"><label htmlFor="rate">Counter funding per unit ($)</label><input id="rate" name="rate" inputMode="decimal" defaultValue={(ev.counterRate ?? e.vendorPU + 0.1).toFixed(2)} required /></div></div>
                <div className="field"><label htmlFor="cnote">Note to the vendor</label><textarea id="cnote" name="note" maxLength={1000} defaultValue={ev.rec === 'Counter' ? ev.reason : ''} required /></div>
                <div><button className="btn warn">Send back with counter</button></div></form>
              <form action={decideDeal} className="form" style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="decision" value="reject" />
                <div className="field"><label htmlFor="rnote">Reason for rejecting (the vendor sees this)</label><textarea id="rnote" name="note" maxLength={1000} required /></div>
                <div><button className="btn bad">Reject</button></div></form>
            </>}
          </div></section>}

          {editable && <section className="panel"><div className="panel-h"><h2>{d.status === 'SENT_BACK' ? 'Respond' : 'Submit'}</h2></div><div className="panel-b form">
            {d.status === 'SENT_BACK' && d.counterRate && vendorUser && <form action={acceptCounter} className="form"><input type="hidden" name="id" value={d.id} />
              <p style={{ margin: 0 }}>Accepting adds about ${Math.max(0, d.counterRate - e.vendorPU).toFixed(2)} per unit to each UPC’s unit scan and resubmits.</p><div><button className="btn primary">Accept ${d.counterRate.toFixed(2)}/unit and resubmit</button></div></form>}
            <form action={submitDeal} className="form"><input type="hidden" name="id" value={d.id} />
              <div className="field"><label htmlFor="signer">Authorized signer</label><input id="signer" name="signer" defaultValue={d.signer ?? (vendorUser ? me.user.name : '')} maxLength={120} required /></div>
              <p className="hint" style={{ margin: 0 }}>Signing submits this contract version to the retailer under the CAISSP terms.</p>
              <div><button className="btn primary">{d.status === 'SENT_BACK' ? 'Resubmit as is' : 'Sign and submit'}</button></div></form>
          </div></section>}

          <section className="panel"><div className="panel-h"><h2>Funding source</h2><FundPill markdown={e.markdown} vendorFunds={e.totalFunds} threshold={r.fullFund} /></div><div className="panel-b">
            {e.type === 'ACCR' ? <p style={{ margin: 0 }}>Growth fund: {pct(d.accrualPct, 1)} of purchases. No markdown to cover.</p> : <>
              <MixBar vendor={e.vendorFunds} wholesaler={e.whFunds} markdown={e.markdown} />
              <p className="small" style={{ marginBottom: 0 }}>Vendor {money(e.vendorFunds)}{e.whFunds ? ` · wholesaler program ${money(e.whFunds)}` : ''} · retailer {money(Math.max(0, e.markdown - e.totalFunds))} of a {money(e.markdown)} markdown. Deals covering at least {pct(r.fullFund)} count as vendor funded.{fund.cls === 'Shared' ? ` The retailer carries ${pct(1 - fund.share)}.` : ''}</p></>}
          </div></section>

          <section className="panel"><div className="panel-h"><h2>Approval rules</h2><span className={`pill ${ev.fails.length ? 'warn' : 'good'}`}>{ev.checks.length - ev.fails.length} of {ev.checks.length} pass</span></div><div className="panel-b">
            {ev.checks.map(c => <div className="chk" key={c.key}><span className={`ic ${c.pass ? 'ok' : 'no'}`}>{c.pass ? '✓' : '✕'}</span><span className="small">{c.label}</span><span className="mono small">{c.value}</span></div>)}
          </div></section>

          <section className="panel"><div className="panel-h"><h2>Audit trail</h2><span className="pill">{trail.length}</span></div><div className="list">
            {trail.map(a => <div className="li" key={a.seq}><div className="grow"><div className="t small">{a.action} <span className="muted">· {a.actorName}</span></div><div className="d">{a.detail}</div></div><div className="small muted mono" style={{ textAlign: 'right' }}>{a.at.toISOString().slice(0, 10)}<div>#{a.hash.slice(0, 8)}</div></div></div>)}
            {!trail.length && <div className="empty small">No entries yet.</div>}
          </div></section>
        </div>
      </div>
    </>
  );
}
