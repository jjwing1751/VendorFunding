import 'server-only';
import { asc, eq, isNotNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { events, items, vendors } from '@/db/schema';
import { currentRules } from '@/lib/data';
import { addDays } from '@/lib/format';
import type { Me } from '@/lib/auth';

export async function formOptions(me: Me) {
  const { values } = await currentRules();
  const evs = (await db.select().from(events).where(ne(events.status, 'COMPLETED')).orderBy(asc(events.startDate)))
    .map(e => ({ id: e.id, name: e.name, startDate: e.startDate, endDate: e.endDate, status: e.status, cutoff: addDays(e.startDate, -values.cutoffDays) }));
  const vend = me.role.org === 'VENDOR' ? [] : (await db.select({ id: vendors.id, name: vendors.name, number: vendors.number }).from(vendors).where(eq(vendors.status, 'ACTIVE')).orderBy(asc(vendors.name)));
  const its = await db.select({ upc: items.upc, description: items.description, casePack: items.casePack, caseCost: items.caseCost, regularRetail: items.regularRetail, baseWeeklyUnits: items.baseWeeklyUnits, vendorId: items.vendorId })
    .from(items).where(me.role.org === 'VENDOR' ? eq(items.vendorId, me.vendor!.id) : isNotNull(items.vendorId)).orderBy(asc(items.description));
  return { events: evs, vendors: vend, items: its, threshold: values.fullFund };
}
