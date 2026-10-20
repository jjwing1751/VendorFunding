import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { requireUser } from '@/lib/auth';
import { otpauthUrl } from '@/lib/crypto';
import { PageHead } from '@/components/ui';
import { MfaConfirmForm } from '../Forms';
import { startMfa } from '../actions';

export default async function MfaSetup() {
  const me = await requireUser({ allowPending: true });
  if (me.user.mustChangePassword) redirect('/account/password');
  if (me.user.totpEnabled) redirect('/account');
  if (!me.user.totpSecret) {
    return (
      <>
        <PageHead title="Set up two-step verification" sub={me.role.requireMfa ? `Your role (${me.role.name}) requires it.` : 'Adds a 6-digit code from your phone at sign-in.'} />
        <section className="panel"><div className="panel-b"><form action={startMfa}><button className="btn primary">Start setup</button></form></div></section>
      </>
    );
  }
  const qr = await QRCode.toDataURL(otpauthUrl(me.user.totpSecret, me.user.email), { margin: 1, width: 220 });
  return (
    <>
      <PageHead title="Set up two-step verification" sub="Scan the code with your authenticator app, then enter the 6-digit code it shows." />
      <section className="panel"><div className="panel-b" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for your authenticator app" width={220} height={220} style={{ borderRadius: 8, background: '#fff' }} />
        <div className="form" style={{ flex: 1, minWidth: 260 }}>
          <div><div className="lbl small muted">Can’t scan? Enter this key in the app</div><div className="secret">{me.user.totpSecret.match(/.{1,4}/g)?.join(' ')}</div></div>
          <MfaConfirmForm />
        </div>
      </div></section>
    </>
  );
}
