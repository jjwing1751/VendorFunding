import { asc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { events, items, vendors } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { PromoForm } from '../PromoForm';

export default async function NewPromo() {
  const me = await requireUser();
  if (!can(me, 'add_retail_promos')) return <PageHead title="Add retailer-funded promotion" sub={`Your role (${me.role.name}) can’t add promotions.`} />;
  const evs = await db.select().from(events).where(ne(events.status, 'COMPLETED')).orderBy(asc(events.startDate));
  const vs = await db.select({ id: vendors.id, name: vendors.name }).from(vendors).where(eq(vendors.status, 'ACTIVE')).orderBy(asc(vendors.name));
  const its = (await db.select().from(items).orderBy(asc(items.description))).map(i => ({ upc: i.upc, description: i.description, regularRetail: i.regularRetail, unitCost: Math.round(i.caseCost / i.casePack * 100) / 100, vendorId: i.vendorId }));
  return <><PageHead title="Add retailer-funded promotion" sub="For promotions the retailer runs without a vendor contract: own brand, fresh, loss leaders, price matches, or brands where the vendor declined to fund." /><section className="panel"><div className="panel-b"><PromoForm events={evs} vendors={vs} items={its} /></div></section></>;
}
