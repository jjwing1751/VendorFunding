'use server';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { deals, fundingRequests, items, promotions, roles, ruleSets, sessions, users, vendors } from '@/db/schema';
import type { RuleValues } from '@/db/schema';
import { audit } from '@/lib/audit';
import { actorName, can, clientIp, requirePerm, requireUser, type Me } from '@/lib/auth';
import { RULE_FIELDS } from '@/lib/economics';
import { currentRules } from '@/lib/data';
import { back, str } from '@/lib/flash';
import { hashPassword, temporaryPassword } from '@/lib/password';
import { PERMS, type Perm } from '@/lib/permissions';
import { DEMO_USERS, demoEnabled, isBuiltInDemo, resetDemo } from '@/lib/demo';

type U = typeof users.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Real (non-demo) active admins. Demo admins don't count, so the last real admin can't be removed. */
async function activeAdminCount(tx: Tx | typeof db, excludeId?: string) {
  const r = await tx.execute(sql`select count(*)::int as n from users u join roles r on r.id = u.role_id where 'manage_users' = any(r.permissions) and u.status = 'ACTIVE' and not u.demo ${excludeId ? sql`and u.id <> ${excludeId}` : sql``}`);
  return (r.rows[0] as { n: number }).n;
}
/** Admins manage everyone; vendor admins manage users at their own company only. */
async function manager(targetVendorId?: string | null) {
  const me = await requireUser();
  if (can(me, 'manage_users')) return { me, scope: 'all' as const };
  if (can(me, 'manage_vendor_users') && me.vendor && (targetVendorId === undefined || targetVendorId === me.vendor.id)) return { me, scope: 'vendor' as const };
  throw new Error(`Your role (${me.role.name}) can’t manage users.`);
}
const pathFor = (me: Me, id?: string) => can(me, 'manage_users') ? (id ? `/admin/users/${id}` : '/admin/users') : '/team';
const DEMO_LIMIT = 'Demo accounts can only change users that testers added, not real accounts or the built-in demo accounts.';
/** Demo testers may manage only the users other testers created, never real users or the shared demo logins. */
const demoBlocked = (me: Me, u: U) => me.user.demo && (!u.demo || isBuiltInDemo(u.email));
async function target(id: string) { const u = (await db.select().from(users).where(eq(users.id, id)))[0]; if (!u) throw new Error('User not found.'); return u; }

export type CreateState = { error?: string; created?: { name: string; email: string; password: string } } | undefined;
const NewUser = z.object({ name: z.string().trim().min(2, 'Enter a name.').max(80), email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160), roleId: z.string().min(1), org: z.string().min(1) });

export async function createUser(_: CreateState, form: FormData): Promise<CreateState> {
  const p = NewUser.safeParse({ name: str(form, 'name'), email: str(form, 'email'), roleId: str(form, 'roleId'), org: str(form, 'org') });
  if (!p.success) return { error: p.error.issues[0].message };
  const vendorId = p.data.org === 'RETAILER' ? null : p.data.org;
  let m; try { m = await manager(vendorId); } catch (e) { return { error: (e as Error).message }; }
  const { me } = m;
  if (m.scope === 'vendor' && vendorId !== me.vendor!.id) return { error: 'You can only add users at your own company.' };
  const role = (await db.select().from(roles).where(eq(roles.id, p.data.roleId)))[0];
  if (!role || role.org !== (vendorId ? 'VENDOR' : 'RETAILER')) return { error: vendorId ? 'Choose a vendor role for vendor users.' : 'Choose a retailer role for retailer users.' };
  if (vendorId) { const v = (await db.select().from(vendors).where(eq(vendors.id, vendorId)))[0]; if (!v || v.status !== 'ACTIVE') return { error: 'That vendor is not active.' }; }
  if ((await db.select({ id: users.id }).from(users).where(eq(users.email, p.data.email))).length) return { error: 'A user with that email already exists.' };
  const cats = form.getAll('categories').map(String).slice(0, 50);
  const password = temporaryPassword();
  await db.transaction(async tx => {
    await tx.insert(users).values({ name: p.data.name, email: p.data.email, roleId: role.id, vendorId, categories: vendorId ? [] : cats, passwordHash: await hashPassword(password), mustChangePassword: true, passwordChangedAt: new Date(), demo: me.user.demo });
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'User added', objectType: 'user', objectId: p.data.email, detail: `${p.data.name} · ${role.name}${cats.length && !vendorId ? ' · ' + cats.join(', ') : ''}${me.user.demo ? ' · demo (removed at the next demo reset)' : ''}`, ip: await clientIp() });
  });
  return { created: { name: p.data.name, email: p.data.email, password } };
}

export async function updateUser(form: FormData) {
  const u = await target(str(form, 'id', 64));
  const { me, scope } = await manager(u.vendorId);
  const path = pathFor(me, u.id);
  if (demoBlocked(me, u)) back(path, { error: DEMO_LIMIT });
  const roleId = str(form, 'roleId', 64);
  const role = (await db.select().from(roles).where(eq(roles.id, roleId)))[0];
  if (!role || role.org !== (u.vendorId ? 'VENDOR' : 'RETAILER')) back(path, { error: 'Choose a role for the same kind of organization.' });
  if (u.id === me.user.id && roleId !== u.roleId) back(path, { error: 'You can’t change your own role.' });
  if (scope === 'vendor' && !u.vendorId) back(path, { error: 'Not allowed.' });
  const losesAdmin = !role.permissions.includes('manage_users') && (await db.select().from(roles).where(eq(roles.id, u.roleId)))[0]?.permissions.includes('manage_users');
  if (losesAdmin && (await activeAdminCount(db, u.id)) === 0) back(path, { error: 'Keep at least one active admin.' });
  const cats = u.vendorId ? [] : form.getAll('categories').map(String).slice(0, 50);
  const name = str(form, 'name', 80) || u.name;
  await db.transaction(async tx => {
    await tx.update(users).set({ roleId, categories: cats, name }).where(eq(users.id, u.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'User updated', objectType: 'user', objectId: u.email, detail: `Role ${role.name}${u.vendorId ? '' : ` · categories: ${cats.join(', ') || 'none'}`}${name !== u.name ? ` · renamed from ${u.name}` : ''}`, ip: await clientIp() });
  });
  back(path, { ok: 'User updated.' });
}

export async function setUserStatus(form: FormData) {
  const u = await target(str(form, 'id', 64));
  const { me } = await manager(u.vendorId);
  const path = pathFor(me, u.id);
  const status = str(form, 'status', 20) === 'DEACTIVATED' ? 'DEACTIVATED' as const : 'ACTIVE' as const;
  if (demoBlocked(me, u)) back(path, { error: DEMO_LIMIT });
  if (u.id === me.user.id) back(path, { error: 'You can’t deactivate yourself.' });
  if (status === 'DEACTIVATED' && (await activeAdminCount(db, u.id)) === 0) back(path, { error: 'Keep at least one active admin.' });
  await db.transaction(async tx => {
    await tx.update(users).set({ status }).where(eq(users.id, u.id));
    if (status === 'DEACTIVATED') await tx.delete(sessions).where(eq(sessions.userId, u.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: status === 'ACTIVE' ? 'User reactivated' : 'User deactivated', objectType: 'user', objectId: u.email, detail: u.name, ip: await clientIp() });
  });
  back(path, { ok: status === 'ACTIVE' ? `${u.name} reactivated.` : `${u.name} deactivated and signed out.` });
}

export type ResetState = { error?: string; password?: string } | undefined;
export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  let u: U, me: Me;
  try { u = await target(str(form, 'id', 64)); ({ me } = await manager(u.vendorId)); } catch (e) { return { error: (e as Error).message }; }
  if (u.id === me.user.id) return { error: 'Change your own password from Account security.' };
  if (demoBlocked(me, u)) return { error: DEMO_LIMIT };
  const password = temporaryPassword();
  await db.transaction(async tx => {
    await tx.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: true, passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
    await tx.delete(sessions).where(eq(sessions.userId, u.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Password reset', objectType: 'user', objectId: u.email, detail: 'Temporary password issued; user signed out everywhere', ip: await clientIp() });
  });
  return { password };
}

export async function resetMfa(form: FormData) {
  const u = await target(str(form, 'id', 64));
  const { me } = await manager(u.vendorId);
  if (demoBlocked(me, u)) back(pathFor(me, u.id), { error: DEMO_LIMIT });
  await db.transaction(async tx => {
    await tx.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, u.id));
    await tx.delete(sessions).where(eq(sessions.userId, u.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'MFA reset', objectType: 'user', objectId: u.email, detail: 'Authenticator removed; user must set it up again if their role requires it', ip: await clientIp() });
  });
  back(pathFor(me, u.id), { ok: 'Two-step verification reset.' });
}

export async function unlockUser(form: FormData) {
  const u = await target(str(form, 'id', 64));
  const { me } = await manager(u.vendorId);
  await db.transaction(async tx => {
    await tx.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'User unlocked', objectType: 'user', objectId: u.email, detail: u.name, ip: await clientIp() });
  });
  back(pathFor(me, u.id), { ok: `${u.name} unlocked.` });
}

export async function deleteUser(form: FormData) {
  const u = await target(str(form, 'id', 64));
  const { me } = await manager(u.vendorId);
  const path = pathFor(me, u.id);
  if (demoBlocked(me, u)) back(path, { error: DEMO_LIMIT });
  if (str(form, 'confirm', 200).toLowerCase() !== u.email.toLowerCase()) back(path, { error: 'Type the user’s email to confirm deletion.' });
  if (u.id === me.user.id) back(path, { error: 'You can’t delete yourself.' });
  if ((await activeAdminCount(db, u.id)) === 0) back(path, { error: 'Keep at least one active admin.' });
  const reassign = str(form, 'reassignTo', 64);
  await db.transaction(async tx => {
    if (reassign && u.categories.length) {
      const to = (await tx.select().from(users).where(eq(users.id, reassign)))[0];
      if (to) { await tx.update(users).set({ categories: [...new Set([...to.categories, ...u.categories])] }).where(eq(users.id, to.id)); await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Categories reassigned', objectType: 'user', objectId: to.email, detail: `${u.categories.join(', ')} from ${u.name}` }); }
    }
    await tx.delete(users).where(eq(users.id, u.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'User deleted', objectType: 'user', objectId: u.email, detail: `${u.name}. Past actions stay in the audit trail under their name.`, ip: await clientIp() });
  });
  back(can(me, 'manage_users') ? '/admin/users' : '/team', { ok: `${u.name} deleted.` });
}

/* ---------- roles ---------- */
export async function saveRoles(form: FormData) {
  const me = await requirePerm('manage_users');
  const all = await db.select().from(roles);
  const changes: string[] = [];
  await db.transaction(async tx => {
    for (const r of all) {
      const perms = PERMS.filter(p => p.org === r.org && form.get(`p:${r.id}:${p.key}`) === 'on').map(p => p.key as Perm);
      if (r.name === 'Admin' && !perms.includes('manage_users')) perms.push('manage_users');
      const mfa = form.get(`mfa:${r.id}`) === 'on' || r.name === 'Admin';
      const before = new Set(r.permissions), after = new Set(perms);
      const added = perms.filter(p => !before.has(p)), removed = r.permissions.filter(p => !after.has(p as Perm));
      if (added.length || removed.length || mfa !== r.requireMfa) {
        await tx.update(roles).set({ permissions: perms, requireMfa: mfa }).where(eq(roles.id, r.id));
        changes.push(`${r.name}: ${[...added.map(a => '+' + a), ...removed.map(a => '−' + a), mfa !== r.requireMfa ? (mfa ? '+MFA required' : '−MFA required') : ''].filter(Boolean).join(', ')}`);
      }
    }
    if (changes.length) await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Role permissions changed', objectType: 'role', objectId: 'roles', detail: changes.join(' | '), ip: await clientIp() });
  });
  back('/admin/roles', changes.length ? { ok: `Updated ${changes.length} role${changes.length > 1 ? 's' : ''}.` } : { ok: 'No changes.' });
}
export async function createRole(form: FormData) {
  const me = await requirePerm('manage_users');
  const name = str(form, 'name', 60); const from = (await db.select().from(roles).where(eq(roles.id, str(form, 'from', 64))))[0];
  if (name.length < 2 || !from) back('/admin/roles', { error: 'Name the role and pick one to start from.' });
  if ((await db.select().from(roles).where(eq(roles.name, name))).length) back('/admin/roles', { error: 'A role with that name exists.' });
  await db.transaction(async tx => {
    await tx.insert(roles).values({ name, org: from.org, permissions: from.permissions.filter(p => !(from.name === 'Admin' && p === 'manage_users')), requireMfa: from.requireMfa });
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Role added', objectType: 'role', objectId: name, detail: `Copied from ${from.name}`, ip: await clientIp() });
  });
  back('/admin/roles', { ok: `${name} added.` });
}
export async function deleteRole(form: FormData) {
  const me = await requirePerm('manage_users');
  const r = (await db.select().from(roles).where(eq(roles.id, str(form, 'id', 64))))[0];
  if (!r || r.system) back('/admin/roles', { error: 'Built-in roles can’t be deleted.' });
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.roleId, r.id)))[0].n;
  if (n) back('/admin/roles', { error: `${n} user${n > 1 ? 's have' : ' has'} this role. Move them first.` });
  await db.transaction(async tx => { await tx.delete(roles).where(eq(roles.id, r.id)); await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Role deleted', objectType: 'role', objectId: r.name, detail: '', ip: await clientIp() }); });
  back('/admin/roles', { ok: `${r.name} deleted.` });
}

/* ---------- vendors ---------- */
const VendorSchema = z.object({ name: z.string().trim().min(2).max(120), number: z.string().trim().regex(/^[0-9A-Za-z-]{3,20}$/, 'Vendor number: 3–20 letters or digits.'), broker: z.string().trim().max(120), category: z.string().trim().min(2, 'Enter a category.').max(60), settlement: z.enum(['INVOICE', 'DEDUCTION']), complianceScore: z.coerce.number().min(0).max(1) });
export async function saveVendor(form: FormData) {
  const me = await requirePerm('manage_users');
  const id = str(form, 'id', 64);
  const p = VendorSchema.safeParse({ name: str(form, 'name'), number: str(form, 'number'), broker: str(form, 'broker'), category: str(form, 'category'), settlement: str(form, 'settlement') || 'INVOICE', complianceScore: str(form, 'complianceScore') || '0.9' });
  if (!p.success) back('/admin/vendors', { error: p.error.issues[0].message });
  const dup = (await db.select().from(vendors).where(and(eq(vendors.number, p.data.number), id ? ne(vendors.id, id) : sql`true`)))[0];
  if (dup) back('/admin/vendors', { error: `Vendor number ${p.data.number} is already used by ${dup.name}.` });
  await db.transaction(async tx => {
    if (id) {
      const cur = (await tx.select().from(vendors).where(eq(vendors.id, id)))[0];
      await tx.update(vendors).set({ ...p.data, broker: p.data.broker || null }).where(eq(vendors.id, id));
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Vendor updated', objectType: 'vendor', objectId: p.data.number, detail: `${cur?.name} · category ${cur?.category}→${p.data.category} · settlement ${cur?.settlement}→${p.data.settlement} · score ${cur?.complianceScore}→${p.data.complianceScore}`, ip: await clientIp() });
    } else {
      await tx.insert(vendors).values({ ...p.data, broker: p.data.broker || null });
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Vendor added', objectType: 'vendor', objectId: p.data.number, detail: `${p.data.name} · ${p.data.category}`, ip: await clientIp() });
    }
  });
  back('/admin/vendors', { ok: id ? 'Vendor updated.' : `${p.data.name} added. Add their vendor admin on the Users page.` });
}
/** Demo testers can't archive or delete a vendor that real users or the built-in demo logins belong to. */
async function vendorProtectedFromDemo(me: Me, vendorId: string) {
  if (!me.user.demo) return false;
  const us = await db.select({ email: users.email, demo: users.demo }).from(users).where(eq(users.vendorId, vendorId));
  return us.some(u => !u.demo || isBuiltInDemo(u.email));
}
export async function setVendorStatus(form: FormData) {
  const me = await requirePerm('manage_users');
  const v = (await db.select().from(vendors).where(eq(vendors.id, str(form, 'id', 64))))[0];
  if (!v) back('/admin/vendors', { error: 'Vendor not found.' });
  const archive = str(form, 'status', 20) === 'ARCHIVED';
  if (archive && await vendorProtectedFromDemo(me, v.id)) back('/admin/vendors', { error: `${v.name} has demo or real user accounts, so a demo account can’t archive it.` });
  await db.transaction(async tx => {
    await tx.update(vendors).set({ status: archive ? 'ARCHIVED' : 'ACTIVE' }).where(eq(vendors.id, v.id));
    if (archive) {
      const us = await tx.select({ id: users.id }).from(users).where(eq(users.vendorId, v.id));
      if (us.length) { await tx.update(users).set({ status: 'DEACTIVATED' }).where(eq(users.vendorId, v.id)); await tx.delete(sessions).where(inArray(sessions.userId, us.map(x => x.id))); }
      const open = await tx.update(deals).set({ status: 'WITHDRAWN', decisionNote: 'Vendor archived', updatedAt: new Date() }).where(and(eq(deals.vendorId, v.id), inArray(deals.status, ['DRAFT', 'SUBMITTED', 'SENT_BACK']))).returning({ number: deals.number });
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Vendor archived', objectType: 'vendor', objectId: v.number, detail: `${v.name} · ${us.length} users deactivated · open deals withdrawn: ${open.map(o => o.number).join(', ') || 'none'}`, ip: await clientIp() });
    } else await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Vendor restored', objectType: 'vendor', objectId: v.number, detail: `${v.name}. Users stay deactivated until reactivated.`, ip: await clientIp() });
  });
  back('/admin/vendors', { ok: archive ? `${v.name} archived.` : `${v.name} restored. Reactivate its users on the Users page.` });
}
export async function deleteVendor(form: FormData) {
  const me = await requirePerm('manage_users');
  const v = (await db.select().from(vendors).where(eq(vendors.id, str(form, 'id', 64))))[0];
  if (!v) back('/admin/vendors', { error: 'Vendor not found.' });
  if (await vendorProtectedFromDemo(me, v.id)) back('/admin/vendors', { error: `${v.name} has demo or real user accounts, so a demo account can’t delete it.` });
  if (str(form, 'confirm', 40) !== v.number) back('/admin/vendors', { error: `Type the vendor number (${v.number}) to confirm deletion.` });
  const nd = (await db.select({ n: sql<number>`count(*)::int` }).from(deals).where(eq(deals.vendorId, v.id)))[0].n;
  const np = (await db.select({ n: sql<number>`count(*)::int` }).from(promotions).where(eq(promotions.brandVendorId, v.id)))[0].n;
  if (nd || np) back('/admin/vendors', { error: `${v.name} has ${nd} deal(s) and ${np} promotion(s) on record, which are part of the audit and billing history. Archive it instead.` });
  await db.transaction(async tx => {
    const us = await tx.delete(users).where(eq(users.vendorId, v.id)).returning({ id: users.id });
    await tx.delete(fundingRequests).where(eq(fundingRequests.vendorId, v.id));
    const its = await tx.delete(items).where(eq(items.vendorId, v.id)).returning({ upc: items.upc });
    await tx.delete(vendors).where(eq(vendors.id, v.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Vendor deleted', objectType: 'vendor', objectId: v.number, detail: `${v.name} · ${us.length} users and ${its.length} items removed`, ip: await clientIp() });
  });
  back('/admin/vendors', { ok: `${v.name} deleted.` });
}

/* ---------- rules ---------- */
export async function saveRules(form: FormData) {
  const me = await requirePerm('edit_rules');
  const { values: cur, version } = await currentRules();
  const next = { ...cur } as RuleValues;
  const changes: string[] = [];
  for (const f of RULE_FIELDS) {
    let v: number | boolean;
    if (f.kind === 'bool') v = form.get(f.key) === 'on';
    else { const n = Number(str(form, f.key, 30)); if (!isFinite(n) || n < 0) back('/admin/rules', { error: `${f.label}: enter a number.` }); v = f.kind === 'pct' ? n / 100 : n; }
    if (v !== cur[f.key]) { changes.push(`${f.label}: ${String(cur[f.key])} → ${String(v)}`); (next as Record<string, number | boolean>)[f.key] = v; }
  }
  if (!changes.length) back('/admin/rules', { ok: 'No changes.' });
  await db.transaction(async tx => {
    const r = await tx.insert(ruleSets).values({ values: next, createdBy: actorName(me) }).returning({ version: ruleSets.version });
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Rules changed', objectType: 'rules', objectId: String(r[0].version), detail: `v${version} → v${r[0].version}: ${changes.join('; ')}`, ip: await clientIp() });
  });
  back('/admin/rules', { ok: 'Rules saved as a new version. Decisions record the version they used.' });
}

/* ---------- demo ---------- */
export async function resetDemoData(form: FormData) {
  const me = await requirePerm('manage_users');
  if (!demoEnabled()) back('/admin/users', { error: 'Demo accounts are turned off.' });
  if (str(form, 'confirm', 20) !== 'RESET') back('/admin/demo', { error: 'Type RESET to confirm.' });
  const envPw = (process.env.DEMO_PASSWORD || '').trim();
  const existing = (await db.select({ h: users.passwordHash }).from(users).where(and(eq(users.demo, true), inArray(users.email, DEMO_USERS.map(d => d.email)))).limit(1))[0];
  const hash = envPw ? await hashPassword(envPw) : existing?.h ?? null;
  let summary = '';
  await db.transaction(async tx => {
    summary = await resetDemo(tx, hash);
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Demo data reset', objectType: 'system', objectId: 'demo', detail: `Reloaded ${summary}; built-in roles and default rules restored; demo walkthroughs restarted`, ip: await clientIp() });
  });
  back('/admin/demo', { ok: `Demo reset: ${summary}. Every demo walkthrough starts again.` });
}
