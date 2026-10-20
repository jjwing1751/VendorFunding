import { isVendorUser, requireUser } from '@/lib/auth';
import { PERMS } from '@/lib/permissions';
import { PageHead } from '@/components/ui';

const CM = [
  ['Find your work', 'My work lists deals waiting on you, plans near their cutoff, and promotions to ask vendors to fund, in due-date order.'],
  ['Review a deal', 'Open it from My work or the Deal inbox. Read the recommendation, the funding source, the approval rules and every UPC line.'],
  ['Decide', 'Approve, send back with a per-unit counter and a note, or reject with a reason. You can decide only on your categories; deals above the auto-approval cap need a category director; you can’t decide on a deal you entered.'],
  ['Plan events', 'Event plans → New event. Set dates, vehicles, media spend and a funding target. Lock the plan at the deal cutoff.'],
  ['Track funding', 'Promotions & funding shows every promotion as vendor funded, shared or retailer funded. Request funding on vendor brands the retailer is carrying.'],
  ['Import a CAISSP', 'Import CAISSP reads a vendor’s spreadsheet into a draft. Another approver decides on it.'],
];
const FINANCE = [
  ['Load actuals', 'Sales & receipts data: upload POS sales (UPC, week, units, sales $) and receipts (UPC, week, cases, cost $) as CSV. Re-sending a UPC-week replaces it.'],
  ['Read the funnel', 'Funding & performance shows each event’s target, what vendors committed, what they earned on actual sales, what was billed and what was collected.'],
  ['Bill what’s owed', 'Billing reconciliation lists ended deals with billable funding not yet billed. Export ready to bill and load it into Bill Back Manager.'],
  ['Import billing results', 'Import Bill Back Manager’s invoice and claim file. Each line is matched to its Fundline deal number; deals move to Billed in full, Under-billed, Over-billed or Collected.'],
  ['Watch accruals', 'Accruals shows % of purchases earned to date, billed, the balance and the claim deadline. Expiring balances are flagged 30 days before the deadline.'],
  ['Score vendors', 'Vendor scorecards compare collection rate, share of markdown, on-time submission and the lift each vendor delivered.'],
];
const VENDOR = [
  ['Sign in', 'Your vendor admin or the retailer admin gives you a temporary password. Change it at first sign-in.'],
  ['Find your work', 'My work shows sent-back deals, drafts, funding requests and open events with their deal cutoffs.'],
  ['Create a deal', 'New CAISSP deal: choose the event, fill in the header and allowance dates, and add one line per UPC. Or import the CAISSP spreadsheet you already use.'],
  ['Check before you submit', 'Save as a draft to see the approval rules, the funding label and the economics. Fix anything flagged, then sign and submit.'],
  ['Respond', 'If a deal is sent back, accept the counter in one click (it raises the unit scan on each UPC) or edit and resubmit.'],
  ['See your funding', 'My funding & scorecard shows what you committed, what was earned on actual sales, what the retailer billed and what was collected, deal by deal. My accruals shows earnings and claim deadlines.'],
];
const ADMIN = [
  ['Add people', 'Users → Add a user. Pick the organization and role; the app creates a temporary password to share securely.'],
  ['Assign categories', 'On a category manager’s page, check the categories they own.'],
  ['Change what roles can do', 'Roles & permissions shows a grid of permissions per role and which roles require two-step verification.'],
  ['Remove access', 'Deactivate signs a user out and blocks sign-in. Delete removes the account; their audit history stays. Vendors with deals are archived, not deleted.'],
  ['Rules', 'Approval rules saves a new version each time; decisions record the version used.'],
];

export default async function Help() {
  const me = await requireUser();
  const mine = PERMS.filter(p => p.org === me.role.org);
  const sections: [string, string[][]][] = isVendorUser(me) ? [['Vendor guide', VENDOR]] : [['Category manager guide', CM], ['Finance and billing guide', FINANCE], ['Admin guide', ADMIN], ['Vendor guide', VENDOR]];
  return (
    <>
      <PageHead title="How to use Fundline" sub="Step-by-step guides for each role." />
      <div className="grid-main">
        <div>{sections.map(([t, steps]) => <section className="panel" key={t}><div className="panel-h"><h2>{t}</h2></div><ol style={{ margin: 0, padding: '12px 16px 12px 36px', display: 'flex', flexDirection: 'column', gap: 10 }}>{steps.map(([h, d]) => <li key={h}><b>{h}</b><div className="small muted">{d}</div></li>)}</ol></section>)}</div>
        <section className="panel"><div className="panel-h"><h2>Your access</h2><span className="pill acc">{me.role.name}</span></div><div className="panel-b">
          {mine.map(p => <div className="chk" key={p.key}><span className={`ic ${me.role.permissions.includes(p.key) ? 'ok' : 'no'}`}>{me.role.permissions.includes(p.key) ? '✓' : '✕'}</span><span className="small">{p.label}</span><span /></div>)}
          <p className="hint" style={{ marginBottom: 0 }}>Need more access? Ask {isVendorUser(me) ? 'your vendor admin or the retailer’s admin' : 'an admin'} to change your role.</p>
        </div></section>
      </div>
    </>
  );
}
