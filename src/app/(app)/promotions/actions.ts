'use server';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { events, fundingRequests, items, promotionLines, promotions } from '@/db/schema';
import { audit } from '@/lib/audit';
import { actorName, clientIp, requirePerm } from '@/lib/auth';
import { nextNumber } from '@/lib/data';
import { back, str } from '@/lib/flash';

const PromoSchema = z.object({
  eventId: z.string().min(1, 'Choose an event.'),
  name: z.string().trim().min(2, 'Name the offer.').max(120),
  reason: z.enum(['Own brand', 'Fresh / seasonal', 'Loss leader', 'Competitive price match', 'Vendor declined to fund', 'Other']),
  brandVendorId: z.string().optional().nullable(),
  lines: z.array(z.object({ upc: z.string().min(1).max(40), promoRetail: z.coerce.number().positive('Enter a promo retail above zero.').max(10000) })).min(1, 'Add at least one UPC.').max(100),
});
export type PromoState = { error?: string } | undefined;

export async function savePromotion(_: PromoState, form: FormData): Promise<PromoState> {
  const me = await requirePerm('add_retail_promos');
  let raw: unknown; try { raw = JSON.parse(String(form.get('payload') ?? '{}')); } catch { return { error: 'Reload and try again.' }; }
  const p = PromoSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const ev = (await db.select().from(events).where(eq(events.id, p.data.eventId)))[0];
  if (!ev || ev.status === 'COMPLETED') return { error: 'Choose an open event.' };
  const its = await db.select().from(items).where(inArray(items.upc, p.data.lines.map(l => l.upc)));
  const bad = p.data.lines.find(l => { const it = its.find(i => i.upc === l.upc); return !it || l.promoRetail > it.regularRetail; });
  if (bad) return { error: `${bad.upc}: not in the item master, or promo retail is above regular retail.` };
  const brand = p.data.brandVendorId || null;
  if (brand && its.some(i => i.vendorId !== brand)) return { error: 'Every UPC must belong to the brand owner you chose.' };
  let id = '';
  await db.transaction(async tx => {
    const number = await nextNumber(tx, 'promo', 'PR');
    const r = await tx.insert(promotions).values({ number, name: p.data.name, reason: p.data.reason, eventId: ev.id, brandVendorId: brand, createdById: me.user.id }).returning({ id: promotions.id });
    id = r[0].id;
    await tx.insert(promotionLines).values(p.data.lines.map(l => { const it = its.find(i => i.upc === l.upc)!; return { promotionId: id, upc: it.upc, description: it.description, unitCost: Math.round(it.caseCost / it.casePack * 100) / 100, regularRetail: it.regularRetail, promoRetail: l.promoRetail, baseWeeklyUnits: it.baseWeeklyUnits }; }));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Retailer-funded promotion added', objectType: 'promotion', objectId: number, detail: `${p.data.name} · ${ev.name} · ${p.data.reason} · ${p.data.lines.length} UPC(s)`, ip: await clientIp() });
  });
  redirect(`/promotions?q=${encodeURIComponent(ev.quarter)}&ok=${encodeURIComponent('Retailer-funded promotion added.')}`);
}

export async function requestFunding(form: FormData) {
  const me = await requirePerm('add_retail_promos');
  const p = await db.query.promotions.findFirst({ where: eq(promotions.id, str(form, 'id', 64)), with: { event: true, brandVendor: true } });
  if (!p || !p.brandVendor) back('/promotions', { error: 'This promotion has no vendor brand to ask.' });
  if (p.fundingRequested) back('/promotions', { error: 'Funding was already requested.' });
  await db.transaction(async tx => {
    await tx.update(promotions).set({ fundingRequested: true }).where(eq(promotions.id, p.id));
    await tx.insert(fundingRequests).values({ vendorId: p.brandVendor!.id, eventId: p.eventId, promotionId: p.id, text: `Fund ${p.name} in ${p.event.name}`, createdById: me.user.id });
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Funding requested', objectType: 'promotion', objectId: p.number, detail: `Asked ${p.brandVendor!.name} to fund ${p.name}`, ip: await clientIp() });
  });
  back(`/promotions?q=${encodeURIComponent(p.event.quarter)}`, { ok: `Request sent to ${p.brandVendor.name}. It appears in their work queue.` });
}
