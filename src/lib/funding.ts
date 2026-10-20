import 'server-only';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { deals } from '@/db/schema';
import { dealEcon, promoEcon } from './economics';

/** Funding per event from deals (committed = approved, pending = submitted/sent back) and retailer-funded markdown. */
export async function eventFunding(eventIds: string[]) {
  const out = new Map<string, { committed: number; pending: number; nDeals: number; retailerMarkdown: number }>();
  for (const id of eventIds) out.set(id, { committed: 0, pending: 0, nDeals: 0, retailerMarkdown: 0 });
  if (!eventIds.length) return out;
  const ds = await db.query.deals.findMany({ where: inArray(deals.eventId, eventIds), with: { lines: true } });
  for (const d of ds) {
    const o = out.get(d.eventId)!; const e = dealEcon({ lines: d.lines, startDate: d.startDate, endDate: d.endDate, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits });
    if (d.status === 'APPROVED') { o.committed += e.totalFunds; o.nDeals++; }
    else if (d.status === 'SUBMITTED' || d.status === 'SENT_BACK') o.pending += e.totalFunds;
  }
  const ps = await db.query.promotions.findMany({ where: (p, { inArray: inA }) => inA(p.eventId, eventIds), with: { lines: true, event: true } });
  for (const p of ps) { const o = out.get(p.eventId)!; o.retailerMarkdown += promoEcon(p.lines, p.event.startDate, p.event.endDate).markdown; }
  return out;
}
