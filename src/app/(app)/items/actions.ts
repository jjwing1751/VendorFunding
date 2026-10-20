'use server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { items, vendors } from '@/db/schema';
import { audit } from '@/lib/audit';
import { actorName, clientIp, requirePerm } from '@/lib/auth';
import { back, str } from '@/lib/flash';

const ItemSchema = z.object({
  upc: z.string().trim().regex(/^[0-9-]{6,20}$/, 'UPC: digits and dashes, 6 to 20 characters.'),
  description: z.string().trim().min(2).max(120), size: z.string().max(20), uom: z.string().max(10), orderCode: z.string().max(30),
  casePack: z.coerce.number().int().min(1).max(1000), caseCost: z.coerce.number().min(0.01).max(100000), regularRetail: z.coerce.number().min(0.01).max(10000),
  baseWeeklyUnits: z.coerce.number().int().min(0).max(1_000_000), vendorId: z.string().max(64),
});

export async function saveItem(form: FormData) {
  const me = await requirePerm('manage_items');
  const existing = str(form, 'existing', 40);
  const p = ItemSchema.safeParse(Object.fromEntries(['upc', 'description', 'size', 'uom', 'orderCode', 'casePack', 'caseCost', 'regularRetail', 'baseWeeklyUnits', 'vendorId'].map(k => [k, str(form, k, 200)])));
  const path = existing ? `/items/${encodeURIComponent(existing)}` : '/items';
  if (!p.success) back(path, { error: p.error.issues[0].message });
  const v = p.data;
  const vendor = v.vendorId ? (await db.select().from(vendors).where(eq(vendors.id, v.vendorId)))[0] : null;
  const row = { description: v.description.toUpperCase(), size: v.size || null, uom: v.uom || null, orderCode: v.orderCode || null, casePack: v.casePack, caseCost: v.caseCost, regularRetail: v.regularRetail, baseWeeklyUnits: v.baseWeeklyUnits, vendorId: vendor?.id ?? null, category: vendor?.category ?? 'Own brand / fresh', updatedAt: new Date() };
  if (!existing && (await db.select({ upc: items.upc }).from(items).where(eq(items.upc, v.upc))).length) back('/items', { error: `UPC ${v.upc} already exists.` });
  await db.transaction(async tx => {
    if (existing) {
      const cur = (await tx.select().from(items).where(eq(items.upc, existing)))[0];
      if (!cur) throw new Error('Item not found.');
      await tx.update(items).set(row).where(eq(items.upc, existing));
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Item updated', objectType: 'item', objectId: existing, detail: `cost $${cur.caseCost}→$${row.caseCost} · retail $${cur.regularRetail}→$${row.regularRetail} · pack ${cur.casePack}→${row.casePack}`, ip: await clientIp() });
    } else {
      await tx.insert(items).values({ upc: v.upc, ...row });
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Item added', objectType: 'item', objectId: v.upc, detail: `${row.description} · ${vendor?.name ?? 'Own brand / fresh'}`, ip: await clientIp() });
    }
  });
  back(`/items/${encodeURIComponent(existing || v.upc)}`, { ok: 'Item saved.' });
}
