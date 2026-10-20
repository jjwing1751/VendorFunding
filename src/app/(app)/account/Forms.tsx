'use client';
import { useActionState } from 'react';
import { changePassword, confirmMfa, disableMfa, type FormState } from './actions';

export function PasswordForm() {
  const [s, a, p] = useActionState<FormState, FormData>(changePassword, undefined);
  return (
    <form action={a} className="form" style={{ maxWidth: 420 }}>
      <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="field"><label htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" required minLength={12} /></div>
      <div className="field"><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} /></div>
      <p className="hint">At least 12 characters, mixing three of: lowercase, uppercase, numbers, symbols.</p>
      {s?.error && <p className="err" role="alert">{s.error}</p>}
      <div><button className="btn primary" disabled={p}>{p ? 'Saving…' : 'Change password'}</button></div>
    </form>
  );
}
export function MfaConfirmForm() {
  const [s, a, p] = useActionState<FormState, FormData>(confirmMfa, undefined);
  return (
    <form action={a} className="form" style={{ maxWidth: 320 }}>
      <div className="field"><label htmlFor="code">Code from the app</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required /></div>
      {s?.error && <p className="err" role="alert">{s.error}</p>}
      <div><button className="btn primary" disabled={p}>Turn on two-step verification</button></div>
    </form>
  );
}
export function MfaDisableForm() {
  const [s, a, p] = useActionState<FormState, FormData>(disableMfa, undefined);
  return (
    <form action={a} className="form" style={{ maxWidth: 320 }}>
      <div className="field"><label htmlFor="pw">Confirm with your password</label><input id="pw" name="password" type="password" autoComplete="current-password" required /></div>
      {s?.error && <p className="err" role="alert">{s.error}</p>}
      <div><button className="btn bad" disabled={p}>Turn off two-step verification</button></div>
    </form>
  );
}
