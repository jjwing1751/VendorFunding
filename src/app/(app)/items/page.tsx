import Link from 'next/link';
import { and, asc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { items, vendors } from '@/db/schema';
import { can, isVendorUser, requireUser } from '@/lib/auth';
import { Empty, Flash, PageHead } from '@/components/ui';
import { ItemForm } from './ItemForm';

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ q?: string; v?: string; ok?: string; error?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const vendor = isVendorUser(me);
  const w: SQL[] = [];
  if (vendor) w.push(eq(items.vendorId, me.vendor!.id));
  else if (sp.v === 'own') w.push(isNull(items.vendorId));
  else if (sp.v) w.push(eq(items.vendorId, sp.v));
  if (sp.q) { const q = `%${sp.q.slice(0, 60)}%`; w.push(or(ilike(items.upc, q), ilike(items.description, q))!); }
  const rows = await db.select({ i: items, vname: vendors.name }).from(items).leftJoin(vendors, eq(vendors.id, items.vendorId)).where(w.length ? and(...w) : undefined).orderBy(asc(items.description)).limit(500);
  const vs = vendor ? [] : await db.select({ id: vendors.id, name: vendors.name }).from(vendors).orderBy(asc(vendors.name));
  return (
    <>
      <PageHead title={vendor ? 'My items (UPC)' : 'Items by UPC'} sub="The item master. Deals and promotions are entered and tracked by UPC; cost, pack and regular retail on a deal come from here." />
      <Flash sp={sp} />
      <form className="toolbar" method="get">
        <input className="inp" name="q" defaultValue={sp.q ?? ''} placeholder="Search UPC or description" style={{ maxWidth: 280 }} aria-label="Search items" />
        {!vendor && <select className="inp" name="v" defaultValue={sp.v ?? ''} style={{ width: 'auto' }} aria-label="Brand owner"><option value="">All brand owners</option><option value="own">Own brand / fresh</option>{vs.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>}
        <button className="btn sm">Search</button><span className="small muted">{rows.length} items</span>
      </form>
      <section className="panel"><div className="tbl"><table><thead><tr><th>UPC</th><th>Description</th>{!vendor && <th>Brand owner</th>}<th className="num">Pack</th><th className="num">Case cost</th><th className="num">Unit cost</th><th className="num">Regular retail</th><th className="num">Base / week</th></tr></thead><tbody>
        {rows.map(({ i, vname }) => <tr key={i.upc}><td><Link className="id" href={`/items/${encodeURIComponent(i.upc)}`}>{i.upc}</Link></td><td>{i.description}</td>{!vendor && <td className="small">{vname ?? 'Own brand / fresh'}</td>}<td className="num">{i.casePack}</td><td className="num">${i.caseCost.toFixed(2)}</td><td className="num">${(i.caseCost / i.casePack).toFixed(2)}</td><td className="num">${i.regularRetail.toFixed(2)}</td><td className="num">{i.baseWeeklyUnits}</td></tr>)}
      </tbody></table>{!rows.length && <Empty>No items match.</Empty>}</div></section>
      {can(me, 'manage_items') && <section className="panel"><div className="panel-h"><h2>Add an item</h2></div><div className="panel-b"><ItemForm vendors={vs} /></div></section>}
    </>
  );
}
