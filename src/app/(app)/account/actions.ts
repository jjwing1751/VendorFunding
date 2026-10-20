'use server';
import { redirect } from 'next/navigation';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { clientIp, createSession, mfaSetupNeeded, requireUser } from '@/lib/auth';
import { newTotpSecret, verifyTotp } from '@/lib/crypto';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/password';

export type FormState = { error?: string; ok?: string } | undefined;
const DEMO_MSG = 'This is a shared demo account, so its password and two-step settings can’t be changed.';

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser({ allowPending: true });
  if (me.user.demo) return { error: DEMO_MSG };
  const current = String(form.get('current') ?? ''); const next = String(form.get('next') ?? ''); const confirm = String(form.get('confirm') ?? '');
  if (!(await verifyPassword(current, me.user.passwordHash))) return { error: 'Your current password is not right.' };
  if (next !== confirm) return { error: 'The new passwords don’t match.' };
  if (next === current) return { error: 'Choose a password you haven’t used here before.' };
  const problem = passwordProblem(next, me.user.email); if (problem) return { error: problem };
  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(users).set({ passwordHash: await hashPassword(next), mustChangePassword: false, passwordChangedAt: now }).where(eq(users.id, me.user.id));
    await tx.delete(sessions).where(eq(sessions.userId, me.user.id));
    await audit(tx, { actorId: me.user.id, actorName: me.user.name, action: 'Password changed', objectType: 'user', objectId: me.user.id, detail: 'All other sessions signed out', ip: await clientIp() });
  });
  await createSession(me.user.id, me.session.mfaPassed);
  redirect(mfaSetupNeeded(me) ? '/account/mfa' : '/account?ok=Password+changed.+Other+sessions+were+signed+out.');
}

export async function startMfa() {
  const me = await requireUser({ allowPending: true });
  if (me.user.totpEnabled || me.user.demo) redirect('/account');
  await db.update(users).set({ totpSecret: newTotpSecret() }).where(eq(users.id, me.user.id));
  redirect('/account/mfa');
}

export async function confirmMfa(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser({ allowPending: true });
  if (me.user.demo) return { error: DEMO_MSG };
  if (!me.user.totpSecret) return { error: 'Start setup again.' };
  if (!verifyTotp(me.user.totpSecret, String(form.get('code') ?? ''))) return { error: 'That code didn’t match. Enter the newest 6-digit code from the app.' };
  await db.update(users).set({ totpEnabled: true }).where(eq(users.id, me.user.id));
  await db.update(sessions).set({ mfaPassed: true }).where(eq(sessions.id, me.session.id));
  await audit(db, { actorId: me.user.id, actorName: me.user.name, action: 'MFA enabled', objectType: 'user', objectId: me.user.id, detail: 'Authenticator app linked', ip: await clientIp() });
  redirect('/account?ok=Two-step+verification+is+on.');
}

export async function disableMfa(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  if (me.user.demo) return { error: DEMO_MSG };
  if (me.role.requireMfa) return { error: `Your role (${me.role.name}) requires two-step verification.` };
  if (!(await verifyPassword(String(form.get('password') ?? ''), me.user.passwordHash))) return { error: 'Your password is not right.' };
  await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, me.user.id));
  await audit(db, { actorId: me.user.id, actorName: me.user.name, action: 'MFA disabled', objectType: 'user', objectId: me.user.id, detail: 'By the user', ip: await clientIp() });
  redirect('/account?ok=Two-step+verification+is+off.');
}

export async function signOutOthers() {
  const me = await requireUser({ allowPending: true });
  if (me.user.demo) redirect('/account?error=Other+testers+share+this+demo+account%2C+so+their+sessions+stay+signed+in.');
  await db.delete(sessions).where(and(eq(sessions.userId, me.user.id), ne(sessions.id, me.session.id)));
  await audit(db, { actorId: me.user.id, actorName: me.user.name, action: 'Signed out other sessions', objectType: 'user', objectId: me.user.id, detail: '' });
  redirect('/account?ok=Other+sessions+signed+out.');
}
