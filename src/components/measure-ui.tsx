import { ACCRUAL_TONE, BILLING_TONE, type AccrualStatus, type BillingStatus } from '@/lib/measure';
import { money, pct } from '@/lib/format';

export const BillPill = ({ s }: { s: BillingStatus }) => <span className={`pill ${BILLING_TONE[s]}`}>{s}</span>;
export const AccrualPill = ({ s, days }: { s: AccrualStatus; days?: number }) => <span className={`pill ${ACCRUAL_TONE[s]}`}>{s}{s === 'Expiring' && days != null ? ` · ${days} days` : ''}</span>;

/** The funding funnel for one scope: target → committed → earned → billed → collected. Bars share one scale; values are always printed. */
export function FundingFunnel({ target, committed, earned, billable, billed, collected, showTarget = true }: { target?: number | null; committed: number; earned: number; billable: number; billed: number; collected: number; showTarget?: boolean }) {
  const rows: { k: string; v: number; cls: string; sub: string }[] = [
    ...(showTarget && target != null ? [{ k: 'Target', v: target, cls: 'f0', sub: 'Funding goal set on the event plans' }] : []),
    { k: 'Committed', v: committed, cls: 'f1', sub: showTarget && target ? `${pct(committed / target)} of target` : 'Approved deals, at forecast' },
    { k: 'Earned', v: earned, cls: 'f2', sub: committed ? `${pct(earned / committed)} of committed · ${money(billable)} billable by us` : `${money(billable)} billable by us` },
    { k: 'Billed', v: billed, cls: 'f3', sub: billable ? `${pct(billed / billable)} of billable earned` : 'From Bill Back Manager' },
    { k: 'Collected', v: collected, cls: 'f4', sub: billed ? `${pct(collected / billed)} of billed` : 'Paid or deducted' },
  ];
  const max = Math.max(1, ...rows.map(r => r.v));
  return (
    <div className="funnel" role="table" aria-label="Funding: target, committed, earned, billed, collected">
      {rows.map(r => (
        <div className="frow" role="row" key={r.k} title={`${r.k}: ${money(r.v)} — ${r.sub}`}>
          <div className="fk" role="rowheader">{r.k}</div>
          <div className="ftrack" role="cell"><i className={r.cls} style={{ width: `${Math.max(0.5, r.v / max * 100)}%` }} /></div>
          <div className="fv num" role="cell">{money(r.v)}</div>
          <div className="fs small muted" role="cell">{r.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function Definitions() {
  return (
    <details className="panel defs"><summary className="panel-h"><h2>How these numbers are measured</h2></summary><div className="panel-b small">
      <dl>
        <dt>Committed</dt><dd>Vendor and wholesaler funding on approved deals, at the forecast units the deal was approved on.</dd>
        <dt>Earned</dt><dd>The same contract rates applied to <b>actual</b> units sold (uploaded POS data, prorated by day for partial weeks), plus ad fees once the deal starts, plus accrual % × purchases received.</dd>
        <dt>Billable earned</dt><dd>The part the retailer bills the vendor: bill-backs, unit scans, ad fees and accruals. Off-invoice allowances are taken on the vendor’s invoice and wholesaler scans are billed by the wholesaler, so they’re earned but not billed here.</dd>
        <dt>Billed / collected</dt><dd>From the Bill Back Manager import, matched to Fundline deals by deal number. Collected = paid or deducted.</dd>
        <dt>Lift</dt><dd>Actual units ÷ baseline units for the same days − 1. Baseline = each UPC’s weekly baseline in the item master. Forecast accuracy = actual ÷ forecast for the same days.</dd>
        <dt>Incremental gross margin</dt><dd>Promo gross margin on actual units (at net cost after vendor funding) + ad fees + accruals − the gross margin the baseline units would have made at regular price.</dd>
        <dt>Return on media</dt><dd>Incremental gross margin ÷ the event’s media spend.</dd>
        <dt>Accrual claim window</dt><dd>Earned accrual must be billed within the claim window after the deal ends (a setting in Approval rules). Balances inside 30 days of the deadline show as Expiring.</dd>
      </dl>
    </div></details>
  );
}
