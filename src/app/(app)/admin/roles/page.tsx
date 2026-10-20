import { asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { roles, users } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { PERMS } from '@/lib/permissions';
import { Flash, PageHead } from '@/components/ui';
import { createRole, deleteRole, saveRoles } from '../actions';

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'manage_users')) return <PageHead title="Roles & permissions" sub="Only admins can manage roles." />;
  const rs = await db.select().from(roles).orderBy(asc(roles.name));
  const counts = new Map((await db.select({ r: users.roleId, n: sql<number>`count(*)::int` }).from(users).groupBy(users.roleId)).map(x => [x.r, x.n]));
  return (
    <>
      <PageHead title="Roles & permissions" sub="What each role can do. Changes apply to everyone with the role on their next click, and are recorded in the audit trail." />
      <Flash sp={await searchParams} />
      <form action={saveRoles}>
        {(['RETAILER', 'VENDOR'] as const).map(org => { const list = rs.filter(r => r.org === org); return (
          <section className="panel" key={org}><div className="panel-h"><h2>{org === 'RETAILER' ? 'Retailer roles' : 'Vendor roles'}</h2></div><div className="tbl"><table><thead><tr><th>Permission</th>{list.map(r => <th key={r.id} className="num" style={{ whiteSpace: 'normal' }}>{r.name}<div className="small muted" style={{ textTransform: 'none', letterSpacing: 0 }}>{counts.get(r.id) ?? 0} users</div></th>)}</tr></thead><tbody>
            {PERMS.filter(p => p.org === org).map(p => <tr key={p.key}><td className="small">{p.label}</td>{list.map(r => <td key={r.id} className="num"><input type="checkbox" name={`p:${r.id}:${p.key}`} defaultChecked={r.permissions.includes(p.key)} disabled={r.name === 'Admin' && p.key === 'manage_users'} aria-label={`${r.name}: ${p.label}`} /></td>)}</tr>)}
            <tr><td className="small"><b>Require two-step verification</b></td>{list.map(r => <td key={r.id} className="num"><input type="checkbox" name={`mfa:${r.id}`} defaultChecked={r.requireMfa} disabled={r.name === 'Admin'} aria-label={`${r.name}: require MFA`} /></td>)}</tr>
          </tbody></table></div></section>); })}
        <div style={{ marginBottom: 14 }}><button className="btn primary">Save permissions</button></div>
      </form>
      <div className="grid2">
        <section className="panel"><div className="panel-h"><h2>Add a role</h2></div><div className="panel-b"><form action={createRole} className="form"><div className="fgrid"><div className="field"><label htmlFor="rname">Role name</label><input id="rname" name="name" maxLength={60} required /></div><div className="field"><label htmlFor="rfrom">Start from</label><select id="rfrom" name="from">{rs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div></div><div><button className="btn">Add role</button></div></form></div></section>
        <section className="panel"><div className="panel-h"><h2>Custom roles</h2></div><div className="list">{rs.filter(r => !r.system).map(r => <div className="li" key={r.id}><div className="grow"><div className="t">{r.name}</div><div className="d">{counts.get(r.id) ?? 0} users</div></div><form action={deleteRole}><input type="hidden" name="id" value={r.id} /><button className="btn sm bad">Delete</button></form></div>)}{!rs.some(r => !r.system) && <div className="empty small">No custom roles.</div>}</div></section>
      </div>
    </>
  );
}
