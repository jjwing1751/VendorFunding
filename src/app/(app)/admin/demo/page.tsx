import Link from 'next/link';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { guideProgress, roles, users, vendors } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { DEMO_USERS, demoEnabled } from '@/lib/demo';
import { guideFor } from '@/lib/guides';
import { fdatetime } from '@/lib/format';
import { Flash, PageHead } from '@/components/ui';
import { resetDemoData } from '../actions';

export default async function DemoAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'manage_users')) return <PageHead title="Demo accounts" sub="Only admins can manage demo accounts." />;
  const sp = await searchParams;
  if (!demoEnabled()) return <PageHead title="Demo accounts" sub="Demo accounts are off. Set DEMO_ACCOUNTS=true in Render and redeploy to turn them on." />;
  const rows = await db.select({ u: users, r: roles, v: vendors }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).leftJoin(vendors, eq(vendors.id, users.vendorId)).where(eq(users.demo, true));
  const prog = rows.length ? await db.select().from(guideProgress).where(inArray(guideProgress.userId, rows.map(r => r.u.id))) : [];
  const builtIn = DEMO_USERS.map(d => ({ d, row: rows.find(r => r.u.email === d.email) }));
  const added = rows.filter(r => !DEMO_USERS.some(d => d.email === r.u.email));
  const pwFromEnv = !!(process.env.DEMO_PASSWORD || '').trim();
  return (
    <>
      <PageHead title="Demo accounts" sub="Shared sign-ins for testers, one per role. Each opens with a guided walkthrough of that role’s workflow." />
      <Flash sp={sp} />
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Demo accounts</div><div className="v">{builtIn.filter(b => b.row?.u.status === 'ACTIVE').length} of {DEMO_USERS.length}</div><div className="s">active</div></div>
        <div className="kpi"><div className="eyebrow">Added by testers</div><div className="v">{added.length}</div><div className="s">removed at the next reset</div></div>
        <div className="kpi"><div className="eyebrow">Shared password</div><div className="v" style={{ fontSize: 16 }}>{pwFromEnv ? 'DEMO_PASSWORD' : 'Generated'}</div><div className="s">{pwFromEnv ? 'Set in Render' : 'Printed once in the first deploy log'}</div></div>
      </div>
      <section className="panel"><div className="panel-h"><h2>Accounts</h2></div>
        <div className="tbl"><table><thead><tr><th>Role</th><th>Name and email</th><th>Company</th><th>Walkthrough</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>
          {builtIn.map(({ d, row }) => {
            const g = guideFor(d.role); const n = row ? prog.filter(p => p.userId === row.u.id).length : 0;
            return <tr key={d.email}><td><b>{d.role}</b></td><td>{row ? <Link className="rowlink" href={`/admin/users/${row.u.id}`}>{d.name}</Link> : d.name}<div className="small muted mono">{d.email}</div></td>
              <td className="small">{row?.v?.name ?? (d.vendorNumber ? 'Vendor missing' : 'Retailer')}</td>
              <td className="small">{g ? `${g.steps.length} steps${n ? ` · ${n} marked by hand` : ''}` : '—'}</td>
              <td className="small">{fdatetime(row?.u.lastLoginAt ?? null)}</td>
              <td>{row ? <span className={`pill ${row.u.status === 'ACTIVE' ? 'good' : ''}`}>{row.u.status.toLowerCase()}</span> : <span className="pill bad">missing</span>}</td></tr>;
          })}
          {added.map(({ u, r, v }) => <tr key={u.id}><td className="small">{r.name}</td><td><Link className="rowlink" href={`/admin/users/${u.id}`}>{u.name}</Link><div className="small muted mono">{u.email}</div></td><td className="small">{v?.name ?? 'Retailer'}</td><td className="small muted">Added by a tester</td><td className="small">{fdatetime(u.lastLoginAt)}</td><td><span className={`pill ${u.status === 'ACTIVE' ? 'good' : ''}`}>{u.status.toLowerCase()}</span></td></tr>)}
        </tbody></table></div>
        <div className="panel-b hint">
          Demo accounts don’t need two-step verification and can’t change their password, so testers can share them. They can manage only users that other testers added, never real accounts. Turn them all off with <span className="mono">DEMO_ACCOUNTS=false</span> in Render; change the password with <span className="mono">DEMO_PASSWORD</span>. Both take effect on the next deploy or restart.
        </div>
      </section>
      <section className="panel"><div className="panel-h"><h2>Reset the demo</h2><span className="pill warn">Affects everyone</span></div>
        <div className="panel-b">
          <p style={{ marginTop: 0 }}>Run this between test sessions. It deletes every deal, event, promotion and item, reloads the sample data with dates relative to today, restores the built-in roles and default approval rules, removes users and vendors that testers added, and restarts every demo walkthrough.</p>
          <p>Real user accounts and the audit trail are kept; the reset itself is logged. Don’t use this once real vendor data is in the system.</p>
          <form action={resetDemoData} className="toolbar" style={{ gap: 8 }}>
            <label htmlFor="confirm" className="small">Type <b className="mono">RESET</b> to confirm</label>
            <input id="confirm" name="confirm" className="inp" autoComplete="off" style={{ width: 120 }} />
            <button className="btn bad">Reset demo data</button>
          </form>
        </div>
      </section>
    </>
  );
}
