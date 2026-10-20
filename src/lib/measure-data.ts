import 'server-only';
import { and, eq, inArray, max, min, sql } from 'drizzle-orm';
import { db } from '@/db';
import { billingRecords, deals, events, promotions, receipts, salesActuals, vendors } from '@/db/schema';
import { can, isVendorUser, type Me } from './auth';
import { currentRules } from './data';
import { addDays, isoToday } from './format';
import { indexActuals, measureDeal } from './measure';

/** Which deals this user may see in funding and performance views. */
export function seesVendorDeal(me: Me, v: { id: string; category: string }) {
  if (isVendorUser(me)) return me.vendor?.id === v.id;
  return can(me, 'all_categories') || me.user.categories.includes(v.category);
}
export const canMeasure = (me: Me) => isVendorUser(me) ? can(me, 'view_own_funding') : can(me, 'view_performance') || can(me, 'manage_billing');
/** Event-level funding targets are only meaningful to people who see every category. */
export const seesTargets = (me: Me) => !isVendorUser(me) && can(me, 'all_categories');

/**
 * Loads approved deals the user can see (optionally limited to some events or one vendor), the sales and
 * receipts for their UPCs, and Bill Back Manager records, then measures each deal.
 */
export async function loadMeasured(me: Me, opts: { eventIds?: string[]; vendorId?: string; dealIds?: string[] } = {}) {
  const today = isoToday();
  const { values: rules } = await currentRules();
  const where = and(
    eq(deals.status, 'APPROVED'),
    opts.eventIds ? (opts.eventIds.length ? inArray(deals.eventId, opts.eventIds) : sql`false`) : undefined,
    opts.vendorId ? eq(deals.vendorId, opts.vendorId) : undefined,
    opts.dealIds ? (opts.dealIds.length ? inArray(deals.id, opts.dealIds) : sql`false`) : undefined,
  );
  const ds = (await db.query.deals.findMany({ where, with: { vendor: true, event: true, lines: true } })).filter(d => seesVendorDeal(me, d.vendor));
  const proms = isVendorUser(me) ? [] : await db.query.promotions.findMany({
    where: opts.eventIds ? (opts.eventIds.length ? inArray(promotions.eventId, opts.eventIds) : sql`false`) : undefined, with: { lines: true, brandVendor: true },
  });
  const visiblePromos = proms.filter(p => can(me, 'all_categories') || (p.brandVendor ? me.user.categories.includes(p.brandVendor.category) : true));
  const upcs = [...new Set([...ds.flatMap(d => d.lines.map(l => l.upc)), ...visiblePromos.flatMap(p => p.lines.map(l => l.upc))])];
  const [sales, recs] = upcs.length
    ? await Promise.all([db.select().from(salesActuals).where(inArray(salesActuals.upc, upcs)), db.select().from(receipts).where(inArray(receipts.upc, upcs))])
    : [[], []];
  const A = indexActuals(sales, recs);
  const nums = ds.map(d => d.number);
  const bills = nums.length ? await db.select().from(billingRecords).where(inArray(billingRecords.dealNumber, nums)) : [];
  const measured = ds.map(d => ({ d, m: measureDeal(d, A, bills, today, rules.claimDays) }));
  return { today, rules, measured, promos: visiblePromos, A, bills };
}
export type Measured = Awaited<ReturnType<typeof loadMeasured>>['measured'][number];

/** Coverage of loaded actuals, for "data through" notes. */
export async function dataCoverage() {
  const [s] = await db.select({ first: min(salesActuals.weekStart), last: max(salesActuals.weekStart), n: sql<number>`count(*)::int`, upcs: sql<number>`count(distinct ${salesActuals.upc})::int` }).from(salesActuals);
  const [r] = await db.select({ first: min(receipts.weekStart), last: max(receipts.weekStart), n: sql<number>`count(*)::int`, upcs: sql<number>`count(distinct ${receipts.upc})::int` }).from(receipts);
  const [b] = await db.select({ n: sql<number>`count(*)::int`, last: max(billingRecords.updatedAt) }).from(billingRecords);
  return {
    sales: { ...s, through: s.last ? addDays(s.last, 6) : null },
    receipts: { ...r, through: r.last ? addDays(r.last, 6) : null },
    billing: b,
  };
}

export async function eventsForWindow(window: string) {
  const today = isoToday();
  const all = await db.select().from(events).orderBy(events.startDate);
  if (window === 'all') return all;
  if (window === 'past') return all.filter(e => e.endDate < today);
  // default: anything that ended in the last 6 months, is running, or starts in the next 60 days
  return all.filter(e => e.endDate >= addDays(today, -183) && e.startDate <= addDays(today, 60));
}

export async function vendorList(me: Me) {
  const vs = await db.select().from(vendors).orderBy(vendors.name);
  return vs.filter(v => seesVendorDeal(me, v));
}
