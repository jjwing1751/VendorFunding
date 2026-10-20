import { asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { deals, users, vendors } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { allCategories } from '@/lib/categories';
import { Flash, PageHead } from '@/components/ui';
import { deleteVendor, saveVendor, setVendorStatus } from '../actions';

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'manage_users')) return <PageHead title="Vendors" sub="Only admins can manage vendors." />;
  const vs = await db.select().from(vendors).orderBy(asc(vendors.name));
  const nd = new Map((await db.select({ v: deals.vendorId, n: sql<number>`count(*)::int` }).from(deals).groupBy(deals.vendorId)).map(x => [x.v, x.n]));
  const nu = new Map((await db.select({ v: users.vendorId, n: sql<number>`count(*)::int` }).from(users).groupBy(users.vendorId)).map(x => [x.v, x.n]));
  const cats = await allCategories();
  const cms = await db.execute(sql`select u.name, u.categories from users u join roles r on r.id = u.role_id where 'approve_deals' = any(r.permissions) and not ('all_categories' = any(r.permissions)) and u.status = 'ACTIVE'`);
  const cmFor = (cat: string) => (cms.rows as { name: string; categories: string[] }[]).filter(x => x.categories.includes(cat)).map(x => x.name).join(', ') || 'Unassigned';
  return (
    <>
      <PageHead title="Vendors" sub="Vendor numbers, categories and settlement. Vendors with deals or promotions on record can be archived but not deleted, so billing and audit history stay complete." />
      <Flash sp={await searchParams} />
      <datalist id="cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
      <section className="panel"><div className="tbl"><table><thead><tr><th>Vendor</th><th>Edit</th><th>Category manager</th><th className="num">Users / deals</th><th>Status</th><th>Archive or delete</th></tr></thead><tbody>
        {vs.map(v => <tr key={v.id}>
          <td><b>{v.name}</b><div className="small muted mono">#{v.number}</div></td>
          <td><form action={saveVendor} className="fgrid" style={{ gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))', minWidth: 520 }}>
            <input type="hidden" name="id" value={v.id} /><input type="hidden" name="name" value={v.name} /><input type="hidden" name="number" value={v.number} />
            <input className="inp" name="category" list="cats" defaultValue={v.category} aria-label="Category" />
            <select className="inp" name="settlement" defaultValue={v.settlement} aria-label="Settlement"><option value="INVOICE">Invoice</option><option value="DEDUCTION">Deduction</option></select>
            <input className="inp" name="complianceScore" defaultValue={v.complianceScore} aria-label="Compliance score (0 to 1)" />
            <input className="inp" name="broker" defaultValue={v.broker ?? ''} placeholder="Broker" aria-label="Broker" style={{ gridColumn: 'span 2' }} />
            <button className="btn sm">Save</button></form></td>
          <td className="small">{cmFor(v.category)}</td><td className="num">{nu.get(v.id) ?? 0} / {nd.get(v.id) ?? 0}</td>
          <td><span className={`pill ${v.status === 'ACTIVE' ? 'good' : ''}`}>{v.status.toLowerCase()}</span></td>
          <td><div className="form" style={{ minWidth: 220 }}>
            <form action={setVendorStatus}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="status" value={v.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'} /><button className="btn sm">{v.status === 'ACTIVE' ? 'Archive (users lose access)' : 'Restore'}</button></form>
            {(nd.get(v.id) ?? 0) === 0 ? <form action={deleteVendor} className="actions"><input type="hidden" name="id" value={v.id} /><input className="inp" name="confirm" placeholder={`Type ${v.number}`} style={{ width: 110 }} aria-label="Confirm vendor number" /><button className="btn sm bad">Delete</button></form> : <span className="hint">Has deals on record: archive only.</span>}
          </div></td></tr>)}
      </tbody></table></div></section>
      <section className="panel"><div className="panel-h"><h2>Add a vendor</h2></div><div className="panel-b"><form action={saveVendor} className="form"><div className="fgrid">
        <div className="field"><label htmlFor="vn">Vendor name</label><input id="vn" name="name" required /></div>
        <div className="field"><label htmlFor="vnum">Vendor number</label><input id="vnum" name="number" required /></div>
        <div className="field"><label htmlFor="vb">Broker</label><input id="vb" name="broker" /></div>
        <div className="field"><label htmlFor="vc">Category</label><input id="vc" name="category" list="cats" required /></div>
        <div className="field"><label htmlFor="vs">Settlement</label><select id="vs" name="settlement"><option value="INVOICE">Invoice</option><option value="DEDUCTION">Deduction</option></select></div>
        <div className="field"><label htmlFor="vsc">Compliance score</label><input id="vsc" name="complianceScore" defaultValue="0.90" /></div>
      </div><div><button className="btn primary">Add vendor</button></div></form></div></section>
    </>
  );
}
