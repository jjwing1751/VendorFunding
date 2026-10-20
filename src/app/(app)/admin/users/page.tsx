import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { roles, users, vendors } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { allCategories } from '@/lib/categories';
import { fdate } from '@/lib/format';
import { Flash, PageHead } from '@/components/ui';
import { CreateUserForm } from '../UserForms';

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; q?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'manage_users')) return <PageHead title="Users" sub="Only admins can manage users." />;
  const sp = await searchParams;
  const rows = await db.select({ u: users, r: roles, v: vendors }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).leftJoin(vendors, eq(vendors.id, users.vendorId)).orderBy(asc(users.name));
  const q = (sp.q ?? '').toLowerCase();
  const list = q ? rows.filter(x => `${x.u.name} ${x.u.email} ${x.r.name} ${x.v?.name ?? ''}`.toLowerCase().includes(q)) : rows;
  const rs = await db.select({ id: roles.id, name: roles.name, org: roles.org }).from(roles).orderBy(asc(roles.name));
  const vs = await db.select({ id: vendors.id, name: vendors.name }).from(vendors).where(eq(vendors.status, 'ACTIVE')).orderBy(asc(vendors.name));
  return (
    <>
      <PageHead title="Users" sub="Add people, set their role and categories, reset passwords, and remove access. Every change is in the audit trail." />
      <Flash sp={sp} />
      <section className="panel"><div className="panel-h"><h2>Add a user</h2></div><div className="panel-b"><CreateUserForm roles={rs} vendors={vs} categories={await allCategories()} /></div></section>
      <section className="panel"><div className="panel-h"><h2>All users</h2><form method="get"><input className="inp" name="q" defaultValue={sp.q ?? ''} placeholder="Search name, email, role, company" aria-label="Search users" /></form></div>
        <div className="tbl"><table><thead><tr><th>Name</th><th>Organization</th><th>Role</th><th>Categories</th><th>Security</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>
          {list.map(({ u, r, v }) => <tr key={u.id}><td><Link className="rowlink" href={`/admin/users/${u.id}`}>{u.name}</Link>{u.id === me.user.id && <span className="pill acc" style={{ marginLeft: 6 }}>You</span>}{u.demo && <span className="pill warn" style={{ marginLeft: 6 }}>Demo</span>}<div className="small muted">{u.email}</div></td>
            <td className="small">{v?.name ?? 'Retailer'}</td><td className="small">{r.name}</td><td className="small">{r.permissions.includes('all_categories') ? 'All' : u.categories.join(', ') || '—'}</td>
            <td className="small">{u.totpEnabled ? 'MFA on' : 'MFA off'}{u.mustChangePassword ? ' · temp password' : ''}{u.lockedUntil && u.lockedUntil > new Date() ? ' · locked' : ''}</td>
            <td className="small">{fdate(u.lastLoginAt)}</td><td><span className={`pill ${u.status === 'ACTIVE' ? 'good' : ''}`}>{u.status.toLowerCase()}</span></td></tr>)}
        </tbody></table></div></section>
    </>
  );
}
