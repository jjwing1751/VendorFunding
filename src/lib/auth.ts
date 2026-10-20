import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { roles, sessions, users, vendors } from '@/db/schema';
import { randomToken, sha256 } from './crypto';
import type { Perm } from './permissions';

export const SESSION_COOKIE = 'fl_session';
const ABSOLUTE_MS = 12 * 60 * 60 * 1000; // sessions end 12 hours after sign-in
const IDLE_MS = 2 * 60 * 60 * 1000;      // or after 2 hours without activity
export const MAX_FAILED = 5;
export const LOCK_MS = 15 * 60 * 1000;

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
}

export async function createSession(userId: string, mfaPassed: boolean) {
  const token = randomToken(32);
  const h = await headers();
  await db.insert(sessions).values({
    tokenHash: sha256(token), userId, mfaPassed, createdAt: new Date(), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + ABSOLUTE_MS),
    ip: await clientIp(), userAgent: (h.get('user-agent') ?? '').slice(0, 300),
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: ABSOLUTE_MS / 1000,
  });
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  c.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db.select({ session: sessions, user: users, role: roles, vendor: vendors })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId)).innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(vendors, eq(vendors.id, users.vendorId)).where(eq(sessions.tokenHash, sha256(token))).limit(1);
  const r = rows[0];
  if (!r) return null;
  const now = Date.now();
  const expired = r.session.expiresAt.getTime() < now || r.session.lastSeenAt.getTime() + IDLE_MS < now;
  // Changing or resetting a password ends every session that started before the change.
  const blocked = r.user.status !== 'ACTIVE' || (r.vendor && r.vendor.status !== 'ACTIVE') || r.session.createdAt.getTime() < r.user.passwordChangedAt.getTime();
  if (expired || blocked) { await db.delete(sessions).where(eq(sessions.id, r.session.id)); return null; }
  if (now - r.session.lastSeenAt.getTime() > 60_000) await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, r.session.id));
  return { session: r.session, user: r.user, role: r.role, vendor: r.vendor };
}

export type Me = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** Gatekeeper for every signed-in page and action. */
export async function requireUser(opts: { allowPending?: boolean } = {}): Promise<Me> {
  const me = await getSessionUser();
  if (!me) redirect('/login');
  if (!me.session.mfaPassed) redirect('/login/mfa');
  if (!opts.allowPending) {
    if (me.user.mustChangePassword) redirect('/account/password');
    if (mfaSetupNeeded(me)) redirect('/account/mfa');
  }
  return me;
}

/** Shared demo accounts skip the MFA requirement (testers can't share one authenticator). */
export const mfaSetupNeeded = (me: Pick<Me, 'role' | 'user'>) => me.role.requireMfa && !me.user.totpEnabled && !me.user.demo;

export const can = (me: Me, p: Perm) => me.role.permissions.includes(p);
export const isVendorUser = (me: Me) => me.role.org === 'VENDOR';

export async function requirePerm(p: Perm) {
  const me = await requireUser();
  if (!can(me, p)) throw new Error(`Your role (${me.role.name}) does not allow this.`);
  return me;
}

/** Category scope for retailer users: directors/admins see all, category managers only their categories. */
export function inScope(me: Me, category: string) {
  if (isVendorUser(me)) return false;
  return can(me, 'all_categories') || me.user.categories.includes(category);
}

export const actorName = (me: Me) => `${me.user.name} (${me.role.name}${me.vendor ? ', ' + me.vendor.name : ''})`;
