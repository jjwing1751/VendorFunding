import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { roles, users } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { fdate } from '@/lib/format';
import { Flash, PageHead } from '@/components/ui';
import { CreateUserForm } from '../admin/UserForms';
import { UserDetail } from '../admin/UserDetail';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; u?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'manage_vendor_users') || !me.vendor) return <PageHead title="My team" sub="Only your company’s vendor admin can manage users." />;
  const sp = await searchParams;
  const team = await db.select({ u: users, r: roles }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(eq(users.vendorId, me.vendor.id)).orderBy(asc(users.name));
  const rs = await db.select({ id: roles.id, name: roles.name, org: roles.org }).from(roles).where(eq(roles.org, 'VENDOR'));
  const sel = team.find(t => t.u.id === sp.u);
  return (
    <>
      <PageHead title={`${me.vendor.name} team`} sub="People at your company who can use the vendor portal." />
      <Flash sp={sp} />
      <section className="panel"><div className="tbl"><table><thead><tr><th>Name</th><th>Role</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>
        {team.map(({ u, r }) => <tr key={u.id}><td><b>{u.name}</b><div className="small muted">{u.email}</div></td><td>{r.name}</td><td className="small">{fdate(u.lastLoginAt)}</td><td><span className={`pill ${u.status === 'ACTIVE' ? 'good' : ''}`}>{u.status.toLowerCase()}</span></td><td>{u.id !== me.user.id && <a className="btn sm" href={`/team?u=${u.id}`}>Manage</a>}</td></tr>)}
      </tbody></table></div></section>
      {sel && <><h2 style={{ margin: '6px 0 10px' }}>{sel.u.name}</h2><UserDetail u={sel.u} me={me} /></>}
      <section className="panel"><div className="panel-h"><h2>Add a teammate</h2></div><div className="panel-b"><CreateUserForm roles={rs} vendors={[]} categories={[]} fixedVendor={me.vendor.id} /></div></section>
    </>
  );
}
