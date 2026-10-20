import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { roles, users, type users as U } from '@/db/schema';
import type { Me } from '@/lib/auth';
import { allCategories } from '@/lib/categories';
import { fdatetime } from '@/lib/format';
import { deleteUser, resetMfa, setUserStatus, unlockUser, updateUser } from './actions';
import { ResetPasswordForm } from './UserForms';

export async function UserDetail({ u, me }: { u: typeof U.$inferSelect; me: Me }) {
  const rs = await db.select().from(roles).where(eq(roles.org, u.vendorId ? 'VENDOR' : 'RETAILER')).orderBy(asc(roles.name));
  const cats = u.vendorId ? [] : await allCategories();
  const others = u.vendorId ? [] : await db.select({ id: users.id, name: users.name }).from(users).where(and(ne(users.id, u.id), eq(users.status, 'ACTIVE'))).orderBy(asc(users.name));
  const self = u.id === me.user.id;
  return (
    <div className="grid2">
      <section className="panel"><div className="panel-h"><h2>Role and access</h2></div><div className="panel-b">
        <form action={updateUser} className="form"><input type="hidden" name="id" value={u.id} />
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" defaultValue={u.name} maxLength={80} /></div>
          <div className="field"><label htmlFor="role">Role</label><select id="role" name="roleId" defaultValue={u.roleId} disabled={self}>{rs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{self && <><input type="hidden" name="roleId" value={u.roleId} /><span className="hint">You can’t change your own role.</span></>}</div>
          {cats.length > 0 && <div className="field"><span className="lbl">Categories</span><div className="chips">{cats.map(c => <label key={c} className="chip"><input type="checkbox" name="categories" value={c} defaultChecked={u.categories.includes(c)} /> {c}</label>)}</div><span className="hint">Category managers can only decide deals from vendors in these categories.</span></div>}
          <div><button className="btn primary">Save</button></div></form>
      </div></section>
      <section className="panel"><div className="panel-h"><h2>Security</h2></div><div className="panel-b form">
        <dl className="kv"><dt>Status</dt><dd>{u.status.toLowerCase()}</dd><dt>Two-step verification</dt><dd>{u.totpEnabled ? 'On' : 'Off'}</dd><dt>Password</dt><dd>{u.mustChangePassword ? 'Temporary, must change at sign-in' : `Changed ${fdatetime(u.passwordChangedAt)}`}</dd><dt>Last sign-in</dt><dd>{fdatetime(u.lastLoginAt)}</dd><dt>Locked</dt><dd>{u.lockedUntil && u.lockedUntil > new Date() ? `Until ${fdatetime(u.lockedUntil)}` : 'No'}</dd></dl>
        {!self && <>
          <ResetPasswordForm id={u.id} />
          <div className="actions">
            {u.lockedUntil && u.lockedUntil > new Date() && <form action={unlockUser}><input type="hidden" name="id" value={u.id} /><button className="btn">Unlock</button></form>}
            {u.totpEnabled && <form action={resetMfa}><input type="hidden" name="id" value={u.id} /><button className="btn">Reset two-step verification</button></form>}
            <form action={setUserStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value={u.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE'} /><button className={`btn ${u.status === 'ACTIVE' ? 'warn' : ''}`}>{u.status === 'ACTIVE' ? 'Deactivate and sign out' : 'Reactivate'}</button></form>
          </div>
          <form action={deleteUser} className="form" style={{ borderTop: '1px dashed var(--line)', paddingTop: 12 }}><input type="hidden" name="id" value={u.id} />
            <b>Delete this user</b><span className="hint">Removes the account. Their past actions stay in the audit trail under their name. Deactivate instead if they may come back.</span>
            {u.categories.length > 0 && <div className="field"><label htmlFor="reassignTo">Give their categories ({u.categories.join(', ')}) to</label><select id="reassignTo" name="reassignTo" defaultValue=""><option value="">Leave unassigned</option>{others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
            <div className="field"><label htmlFor="confirm">Type {u.email} to confirm</label><input id="confirm" name="confirm" autoComplete="off" /></div>
            <div><button className="btn bad">Delete user</button></div></form>
        </>}
      </div></section>
    </div>
  );
}
