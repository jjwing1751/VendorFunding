'use client';
import { useActionState, useState } from 'react';
import { createUser, resetPassword, type CreateState, type ResetState } from './actions';

type Role = { id: string; name: string; org: 'RETAILER' | 'VENDOR' };
export function CreateUserForm({ roles, vendors, categories, fixedVendor }: { roles: Role[]; vendors: { id: string; name: string }[]; categories: string[]; fixedVendor?: string }) {
  const [s, a, p] = useActionState<CreateState, FormData>(createUser, undefined);
  const [org, setOrg] = useState(fixedVendor ?? 'RETAILER');
  const rs = roles.filter(r => r.org === (org === 'RETAILER' ? 'RETAILER' : 'VENDOR'));
  return (
    <form action={a} className="form" key={s?.created?.email}>
      {s?.created && <div className="callout Approve"><b>{s.created.name} can now sign in.</b> Send them their email and this temporary password through a channel you trust. They must change it at first sign-in, and it isn’t shown again.<div className="secret" style={{ marginTop: 8 }}>{s.created.email} · {s.created.password}</div></div>}
      <div className="fgrid">
        <div className="field"><label htmlFor="nu_name">Name</label><input id="nu_name" name="name" required maxLength={80} /></div>
        <div className="field"><label htmlFor="nu_email">Email</label><input id="nu_email" name="email" type="email" required maxLength={160} /></div>
        {fixedVendor ? <input type="hidden" name="org" value={fixedVendor} /> : <div className="field"><label htmlFor="nu_org">Organization</label><select id="nu_org" name="org" value={org} onChange={e => setOrg(e.target.value)}><option value="RETAILER">Retailer staff</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>}
        <div className="field"><label htmlFor="nu_role">Role</label><select id="nu_role" name="roleId" key={org}>{rs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      </div>
      {org === 'RETAILER' && categories.length > 0 && <div className="field"><span className="lbl">Categories (for category managers)</span><div className="chips">{categories.map(c => <label key={c} className="chip"><input type="checkbox" name="categories" value={c} /> {c}</label>)}</div></div>}
      {s?.error && <p className="err" role="alert">{s.error}</p>}
      <div><button className="btn primary" disabled={p}>Add user and create temporary password</button></div>
    </form>
  );
}
export function ResetPasswordForm({ id }: { id: string }) {
  const [s, a, p] = useActionState<ResetState, FormData>(resetPassword, undefined);
  return (
    <form action={a} className="form">
      <input type="hidden" name="id" value={id} />
      {s?.password && <div className="callout Approve"><b>New temporary password.</b> Share it securely; they must change it at sign-in. All their sessions were signed out.<div className="secret" style={{ marginTop: 8 }}>{s.password}</div></div>}
      {s?.error && <p className="err">{s.error}</p>}
      <div><button className="btn" disabled={p}>Reset password</button></div>
    </form>
  );
}
