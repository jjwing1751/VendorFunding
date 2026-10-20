'use server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { roles, sessions, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { clientIp, createSession, destroySession, getSessionUser, LOCK_MS, MAX_FAILED } from '@/lib/auth';
import { verifyTotp } from '@/lib/crypto';
import { verifyPassword } from '@/lib/password';

// Per-IP throttle on failed attempts (in memory, single instance). Account lockout below is the main control.
const fails = new Map<string, { n: number; at: number }>();
function throttled(ip: string) { const h = fails.get(ip); return !!h && Date.now() - h.at < 15 * 60_000 && h.n >= 30; }
function recordFail(ip: string) { const now = Date.now(); const h = fails.get(ip); if (!h || now - h.at > 15 * 60_000) fails.set(ip, { n: 1, at: now }); else h.n++; }

const GENERIC = 'That email and password don’t match an active account.';
// A real bcrypt hash of a random string, used to keep timing similar when the email is unknown.
const DUMMY = '$2b$12$Edf.zhmqdA17k2WuY1qbTuvmhKL9tdh2ZavhIcYXkkpy5JERHKWc2';

export type LoginState = { error?: string } | undefined;

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(form.get('password') ?? '').slice(0, 200);
  const ip = (await clientIp()) ?? 'unknown';
  if (throttled(ip)) return { error: 'Too many attempts from this network. Wait 15 minutes and try again.' };
  if (!email || !password) return { error: 'Enter your email and password.' };

  const row = (await db.select({ user: users, role: roles }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(eq(users.email, email)).limit(1))[0];
  if (!row) { await verifyPassword(password, DUMMY); recordFail(ip); return { error: GENERIC }; }
  const u = row.user;
  if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
    return { error: `This account is locked after ${MAX_FAILED} failed attempts. Try again after ${u.lockedUntil.toISOString().slice(11, 16)} UTC, or ask an admin to unlock it.` };
  }
  const ok = await verifyPassword(password, u.passwordHash);
  if (!ok || u.status !== 'ACTIVE') {
    recordFail(ip);
    if (u.status === 'ACTIVE') {
      const failed = u.failedLogins + 1;
      const lock = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS) : null;
      await db.update(users).set({ failedLogins: lock ? 0 : failed, lockedUntil: lock }).where(eq(users.id, u.id));
      await audit(db, { actorId: u.id, actorName: u.name, action: lock ? 'Account locked' : 'Sign-in failed', objectType: 'user', objectId: u.id, detail: lock ? `Locked for 15 minutes after ${MAX_FAILED} failed attempts` : `Attempt ${failed} of ${MAX_FAILED}`, ip });
    }
    return { error: GENERIC };
  }
  await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await createSession(u.id, !u.totpEnabled);
  await audit(db, { actorId: u.id, actorName: u.name, action: 'Signed in', objectType: 'user', objectId: u.id, detail: u.totpEnabled ? 'Password accepted; waiting for authenticator code' : 'Password accepted', ip });
  redirect(u.totpEnabled ? '/login/mfa' : '/');
}

export async function verifyMfa(_: LoginState, form: FormData): Promise<LoginState> {
  const me = await getSessionUser();
  if (!me) redirect('/login');
  if (me.session.mfaPassed) redirect('/');
  const code = String(form.get('code') ?? '');
  if (!me.user.totpSecret || !verifyTotp(me.user.totpSecret, code)) {
    const failed = me.user.failedLogins + 1;
    if (failed >= MAX_FAILED) {
      await db.update(users).set({ failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }).where(eq(users.id, me.user.id));
      await destroySession();
      await audit(db, { actorId: me.user.id, actorName: me.user.name, action: 'Account locked', objectType: 'user', objectId: me.user.id, detail: 'Too many wrong authenticator codes', ip: await clientIp() });
      redirect('/login?locked=1');
    }
    await db.update(users).set({ failedLogins: failed }).where(eq(users.id, me.user.id));
    return { error: 'That code didn’t work. Check the time on your phone and try the newest code.' };
  }
  await db.update(users).set({ failedLogins: 0 }).where(eq(users.id, me.user.id));
  await db.update(sessions).set({ mfaPassed: true }).where(eq(sessions.id, me.session.id));
  await audit(db, { actorId: me.user.id, actorName: me.user.name, action: 'MFA verified', objectType: 'user', objectId: me.user.id, detail: 'Authenticator code accepted', ip: await clientIp() });
  redirect('/');
}

export async function logout() {
  const me = await getSessionUser();
  if (me) await audit(db, { actorId: me.user.id, actorName: me.user.name, action: 'Signed out', objectType: 'user', objectId: me.user.id, detail: '' });
  await destroySession();
  redirect('/login');
}
