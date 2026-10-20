import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { PasswordForm } from '../Forms';

export default async function ForcePassword() {
  const me = await requireUser({ allowPending: true });
  if (!me.user.mustChangePassword) redirect('/account');
  return (
    <>
      <PageHead title="Choose a new password" sub="You signed in with a temporary password. Set your own to continue." />
      <section className="panel"><div className="panel-b"><PasswordForm /></div></section>
    </>
  );
}
