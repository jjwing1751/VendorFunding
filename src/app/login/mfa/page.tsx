import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { MfaForm } from '../LoginForm';
import { logout } from '../actions';

export const dynamic = 'force-dynamic';

export default async function MfaPage() {
  const me = await getSessionUser();
  if (!me) redirect('/login');
  if (me.session.mfaPassed) redirect('/');
  return (
    <main className="auth">
      <div className="card">
        <div className="brand" style={{ padding: 0 }}><div className="brand-mark">F</div><div><b>Fundline</b><span>Two-step verification</span></div></div>
        <h1>Enter your code</h1>
        <p className="muted" style={{ marginTop: 0 }}>Open your authenticator app and enter the current code for Fundline.</p>
        <MfaForm />
        <form action={logout} style={{ marginTop: 14 }}><button className="linkbtn">Use a different account</button></form>
      </div>
    </main>
  );
}
