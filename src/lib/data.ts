import 'server-only';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { counters, dealLines, deals, events, items, ruleSets, vendors } from '@/db/schema';
import type { RuleValues } from '@/db/schema';
import { DEFAULT_RULES, evaluate } from './economics';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function nextNumber(tx: Tx, name: 'deal' | 'promo' | 'event', prefix: string, pad = 4) {
  const r = await tx.insert(counters).values({ name, value: 1 })
    .onConflictDoUpdate({ target: counters.name, set: { value: sql`${counters.value} + 1` } }).returning({ value: counters.value });
  return `${prefix}-${String(r[0].value).padStart(pad, '0')}`;
}

export async function currentRules(): Promise<{ version: number; values: RuleValues }> {
  const r = await db.select().from(ruleSets).orderBy(desc(ruleSets.version)).limit(1);
  return r[0] ? { version: r[0].version, values: { ...DEFAULT_RULES, ...r[0].values } } : { version: 0, values: DEFAULT_RULES };
}

/** Other non-closed deals that share a UPC and overlap in dates. */
export async function findOverlaps(dealId: string | null, upcs: string[], start: string, end: string) {
  if (!upcs.length) return [];
  const rows = await db.selectDistinct({ number: deals.number }).from(dealLines).innerJoin(deals, eq(deals.id, dealLines.dealId))
    .where(and(inArray(dealLines.upc, upcs), inArray(deals.status, ['SUBMITTED', 'SENT_BACK', 'APPROVED']),
      dealId ? ne(deals.id, dealId) : sql`true`, sql`${deals.startDate} <= ${end}`, sql`${deals.endDate} >= ${start}`, eq(deals.accrualPct, 0)));
  return rows.map(r => r.number);
}

export async function loadDeal(id: string) {
  const d = await db.query.deals.findFirst({ where: eq(deals.id, id), with: { vendor: true, event: true, lines: { orderBy: (l, { asc }) => [asc(l.sort)] }, comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] } } });
  return d ?? null;
}
export type LoadedDeal = NonNullable<Awaited<ReturnType<typeof loadDeal>>>;

export async function evaluateDeal(d: LoadedDeal) {
  const { values, version } = await currentRules();
  const upcs = d.lines.map(l => l.upc);
  const known = upcs.length ? await db.select({ upc: items.upc }).from(items).where(inArray(items.upc, upcs)) : [];
  const unknownUpcs = upcs.filter(u => !known.some(k => k.upc === u));
  const overlaps = d.accrualPct > 0 ? [] : await findOverlaps(d.id, upcs, d.startDate, d.endDate);
  const ev = evaluate({ lines: d.lines, startDate: d.startDate, endDate: d.endDate, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits },
    { rules: values, complianceScore: d.vendor.complianceScore, event: d.event, overlaps, unknownUpcs });
  // Deal cutoff: vendors submit at least N days before the event starts.
  const cutoff = new Date(d.event.startDate + 'T12:00:00Z'); cutoff.setUTCDate(cutoff.getUTCDate() - values.cutoffDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const when = (d.submittedAt ?? new Date()).toISOString().slice(0, 10);
  const c = { key: 'cutoff', label: `Submitted by the deal cutoff (${cutoffIso})`, value: when, pass: when <= cutoffIso };
  ev.checks.push(c);
  if (!c.pass) { ev.fails.push(c); if (ev.rec === 'Approve') { ev.rec = 'Review'; ev.reason = 'Submitted after the deal cutoff, so a category manager has to accept it.'; } }
  ev.score = Math.round(100 * ev.checks.filter(x => x.pass).length / ev.checks.length);
  return { ...ev, rules: values, ruleVersion: version, cutoff: cutoffIso };
}

export async function activeVendors() {
  return db.select().from(vendors).where(eq(vendors.status, 'ACTIVE')).orderBy(vendors.name);
}
export async function openEvents() {
  return db.select().from(events).where(ne(events.status, 'COMPLETED')).orderBy(events.startDate);
}
