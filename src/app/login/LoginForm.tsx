'use client';
import { useActionState, useRef } from 'react';
import { login, verifyMfa, type LoginState } from './actions';

type DemoAccount = { email: string; name: string; role: string; blurb: string; vendor: boolean };

export function LoginForm({ demo = [] }: { demo?: DemoAccount[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const pick = (email: string) => { if (emailRef.current) emailRef.current.value = email; pwRef.current?.focus(); };
  return (
    <>
      <form action={action} className="form" noValidate>
        <div className="field"><label htmlFor="email">Work email</label><input ref={emailRef} id="email" name="email" type="email" autoComplete="username" required autoFocus /></div>
        <div className="field"><label htmlFor="password">Password</label><input ref={pwRef} id="password" name="password" type="password" autoComplete="current-password" required /></div>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <button className="btn primary" disabled={pending} style={{ justifyContent: 'center' }}>{pending ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {demo.length > 0 && (
        <div className="demo-list">
          <div className="eyebrow">Demo accounts</div>
          <p className="hint" style={{ margin: '4px 0 8px' }}>Pick a role to fill in its email, then enter the shared demo password from your Fundline contact. Each account opens with a guided walkthrough.</p>
          <table><tbody>
            {(['Retailer', 'Vendor'] as const).map(grp => demo.filter(d => d.vendor === (grp === 'Vendor')).map((d, i) => (
              <tr key={d.email}>
                <td style={{ width: 70 }}>{i === 0 && <span className={`pill ${grp === 'Vendor' ? 'info' : 'acc'}`}>{grp}</span>}</td>
                <td><b>{d.role}</b><div className="muted">{d.name} · {d.blurb}</div></td>
                <td style={{ textAlign: 'right' }}><button type="button" className="btn sm" onClick={() => pick(d.email)} aria-label={`Use the ${d.role} demo account`}>Use</button></td>
              </tr>
            )))}
          </tbody></table>
        </div>
      )}
    </>
  );
}

export function MfaForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(verifyMfa, undefined);
  return (
    <form action={action} className="form">
      <div className="field"><label htmlFor="code">6-digit code from your authenticator app</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus /></div>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending} style={{ justifyContent: 'center' }}>{pending ? 'Checking…' : 'Verify'}</button>
    </form>
  );
}
