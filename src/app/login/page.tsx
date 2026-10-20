import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';
import { DEMO_USERS, demoEnabled } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const me = await getSessionUser();
  if (me?.session.mfaPassed) redirect('/');
  const sp = await searchParams;
  return (
    <main className="auth">
      <div className="card" style={demoEnabled() ? { maxWidth: 520 } : undefined}>
        <div className="brand" style={{ padding: 0 }}><div className="brand-mark">F</div><div><b>Fundline</b><span>{process.env.RETAILER_NAME ?? 'Vendor funding'}</span></div></div>
        <h1>Sign in</h1>
        <p className="muted" style={{ marginTop: 0 }}>Vendor funding for category managers, vendors and finance.</p>
        {sp.locked && <p className="flash err">Too many wrong codes. Your account is locked for 15 minutes.</p>}
        <LoginForm demo={demoEnabled() ? DEMO_USERS.map(d => ({ email: d.email, name: d.name, role: d.role, blurb: d.blurb, vendor: !!d.vendorNumber })) : []} />
        <p className="hint" style={{ marginTop: 16 }}>No account or locked out? Ask your Fundline admin. Accounts lock for 15 minutes after 5 failed attempts.</p>
      </div>
    </main>
  );
}
