import Link from 'next/link';
import { headers } from 'next/headers';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { deals } from '@/db/schema';
import { can, isVendorUser, mfaSetupNeeded, requireUser } from '@/lib/auth';
import { demoEnabled } from '@/lib/demo';
import { guideFor } from '@/lib/guides';
import { canMeasure } from '@/lib/measure-data';
import { logout } from '../login/actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser({ allowPending: true });
  const path = (await headers()).get('x-pathname') ?? '';
  const pending = me.user.mustChangePassword || mfaSetupNeeded(me);
  const tour: Item[] = guideFor(me.role.name) ? [['/guide', 'Guided walkthrough']] : [];
  const v = isVendorUser(me);
  let review = 0, sentBack = 0;
  if (!pending) {
    if (v && me.vendor) sentBack = (await db.select({ n: sql<number>`count(*)::int` }).from(deals).where(and(eq(deals.vendorId, me.vendor.id), eq(deals.status, 'SENT_BACK'))))[0].n;
    else if (can(me, 'approve_deals')) review = (await db.select({ n: sql<number>`count(*)::int` }).from(deals).where(inArray(deals.status, ['SUBMITTED'])))[0].n;
  }
  type Item = [string, string, number?] | ['grp', string];
  const items: Item[] = pending ? [['grp', 'Account'], ['/account', 'Account security']] : v ? [
    ['grp', 'Vendor portal'], ['/', 'My work'], ['/deals', 'My deals', sentBack], ['/deals/new', 'New CAISSP deal'], ['/deals/import', 'Import CAISSP'],
    ['/calendar', 'Promo calendar'], ['/items', 'My items (UPC)'],
    ...(can(me, 'view_own_funding') ? [['/performance/vendors', 'My funding & scorecard'] as Item, ['/accruals', 'My accruals'] as Item] : []),
    ...(can(me, 'manage_vendor_users') ? [['/team', 'My team'] as Item] : []),
    ['grp', 'Account'], ['/account', 'Account security'], ...tour, ['/help', 'How to use Fundline'],
  ] : [
    ['grp', 'Plan'], ['/', 'My work'], ['/events', 'Event plans'], ['/promotions', 'Promotions & funding'], ['/calendar', 'Promo calendar'], ['/items', 'Items by UPC'],
    ['grp', 'Execute'], ['/deals', 'Deal inbox', review], ...(can(me, 'import_caissp') ? [['/deals/import', 'Import CAISSP'] as Item] : []),
    ...(canMeasure(me) ? [['grp', 'Measure'] as Item, ['/performance', 'Funding & performance'] as Item, ['/accruals', 'Accruals'] as Item, ['/billing', 'Billing reconciliation'] as Item, ['/performance/vendors', 'Vendor scorecards'] as Item] : []),
    ...(can(me, 'upload_actuals') || can(me, 'view_performance') ? [['/data', 'Sales & receipts data'] as Item] : []),
    ['grp', 'Control'], ...(can(me, 'edit_rules') ? [['/admin/rules', 'Approval rules'] as Item] : []), ...(can(me, 'view_audit') ? [['/audit', 'Audit trail'] as Item] : []),
    ...(can(me, 'manage_users') ? [['/admin/users', 'Users'] as Item, ['/admin/roles', 'Roles & permissions'] as Item, ['/admin/vendors', 'Vendors'] as Item] : []),
    ...(can(me, 'manage_users') && demoEnabled() ? [['/admin/demo', 'Demo accounts'] as Item] : []),
    ['grp', 'Account'], ['/account', 'Account security'], ...tour, ['/help', 'How to use Fundline'],
  ];
  // The longest nav link that matches the current path is the current one (so /performance/vendors doesn't also light up /performance).
  const matches = items.filter((it): it is [string, string, number?] => it[0] !== 'grp').map(it => it[0]).filter(h => h === '/' ? path === '/' : path === h || path.startsWith(h + '/'));
  const best = matches.sort((a, b) => b.length - a.length)[0];
  const isCur = (href: string) => href === best;
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand"><div className="brand-mark">F</div><div><b>Fundline</b><span>{process.env.RETAILER_NAME ?? 'Vendor funding'}</span></div></div>
        {items.map((it, i) => it[0] === 'grp'
          ? <div key={i} className="grp eyebrow">{it[1]}</div>
          : <Link key={i} className="nav" href={it[0]} aria-current={isCur(it[0]) ? 'page' : undefined}>{it[1]}{it[2] ? <span className="badge">{it[2]}</span> : null}</Link>)}
        <div className="me">
          <b>{me.user.name}</b>
          <div className="muted">{me.role.name}{me.vendor ? ` · ${me.vendor.name}` : ''}</div>
          {me.user.demo && <span className="pill warn" style={{ marginTop: 6 }} title="Shared demo account. Other testers may be signed in as this user too.">Demo account</span>}
          <form action={logout} style={{ marginTop: 8 }}><button className="btn sm">Sign out</button></form>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
