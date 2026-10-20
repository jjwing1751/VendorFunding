import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { mfaSetupNeeded, requireUser } from '@/lib/auth';
import { fdatetime } from '@/lib/format';
import { Flash, PageHead } from '@/components/ui';
import { MfaDisableForm, PasswordForm } from './Forms';
import { signOutOthers, startMfa } from './actions';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser({ allowPending: true });
  const sp = await searchParams;
  const mine = await db.select().from(sessions).where(eq(sessions.userId, me.user.id)).orderBy(desc(sessions.lastSeenAt));
  return (
    <>
      <PageHead title="Account security" sub={`${me.user.name} · ${me.user.email} · ${me.role.name}${me.vendor ? ' at ' + me.vendor.name : ''}`} />
      <Flash sp={sp} />
      {me.user.mustChangePassword && <p className="flash err">Set a new password before you continue.</p>}
      {!me.user.mustChangePassword && mfaSetupNeeded(me) && <p className="flash err">Your role requires two-step verification. Turn it on below to continue.</p>}
      {me.user.demo ? <section className="panel"><div className="panel-h"><h2>Shared demo account</h2><span className="pill warn">Demo</span></div><div className="panel-b">
        <p style={{ marginTop: 0 }}>Several testers sign in as {me.user.name}, so the password and two-step verification can’t be changed here, and the {me.role.name} role’s MFA requirement is waived for this account. The shared password is set by your Fundline admin.</p>
        <p className="hint" style={{ marginBottom: 0 }}>Real accounts work differently: a temporary password that must be changed at first sign-in, and an authenticator app wherever the role requires it.</p>
      </div></section> : <div className="grid2">
        <section className="panel"><div className="panel-h"><h2>Password</h2></div><div className="panel-b"><PasswordForm /></div></section>
        <section className="panel"><div className="panel-h"><h2>Two-step verification</h2><span className={`pill ${me.user.totpEnabled ? 'good' : 'warn'}`}>{me.user.totpEnabled ? 'On' : 'Off'}</span></div>
          <div className="panel-b form">
            <p style={{ margin: 0 }}>Use an authenticator app (Microsoft Authenticator, Google Authenticator, 1Password) to add a 6-digit code at sign-in.{me.role.requireMfa ? ' Your role requires it.' : ''}</p>
            {me.user.totpEnabled ? (!me.role.requireMfa && <MfaDisableForm />) : <form action={startMfa}><button className="btn primary">Set up two-step verification</button></form>}
          </div></section>
      </div>}
      <section className="panel"><div className="panel-h"><h2>Where you’re signed in</h2>{!me.user.demo && <form action={signOutOthers}><button className="btn sm">Sign out everywhere else</button></form>}</div>
        <div className="tbl"><table><thead><tr><th>Started</th><th>Last active</th><th>Expires</th><th>Network</th><th>Browser</th><th></th></tr></thead><tbody>
          {mine.map(s => <tr key={s.id}><td className="small">{fdatetime(s.createdAt)}</td><td className="small">{fdatetime(s.lastSeenAt)}</td><td className="small">{fdatetime(s.expiresAt)}</td><td className="mono small">{s.ip ?? '—'}</td><td className="small">{(s.userAgent ?? '').slice(0, 70)}</td><td>{s.id === me.session.id && <span className="pill acc">This session</span>}</td></tr>)}
        </tbody></table></div>
        <div className="panel-b hint">Sessions end after 2 hours without activity or 12 hours after sign-in. Changing your password signs out every other session.</div>
      </section>
    </>
  );
}
