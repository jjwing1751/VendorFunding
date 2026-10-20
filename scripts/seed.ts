/* Idempotent startup seed: roles, rules, first admin, and (optionally) fictional demo data. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import * as s from '../src/db/schema';
import { DEFAULT_ROLES, PERMS_V2 } from '../src/lib/permissions';
import { DEFAULT_RULES } from '../src/lib/economics';
import { demoEnabled, disableDemoUsers, ensureDemoUsers, loadDemoData } from '../src/lib/demo';
import { passwordProblem } from '../src/lib/password';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const pool = new Pool({ connectionString: url, ssl: /\.render\.com|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
const db = drizzle(pool, { schema: s });
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const sha = (x: string) => createHash('sha256').update(x).digest('hex');
async function audit(tx: Tx, action: string, objectType: string, objectId: string, detail: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(734221)`);
  const last = (await tx.execute(sql`select seq, hash from audit_log order by seq desc limit 1`)).rows[0] as { seq: number; hash: string } | undefined;
  const prev = last?.hash ?? '0'.repeat(64); const seq = (last?.seq ?? 0) + 1; const at = new Date();
  const hash = sha(prev + '|' + JSON.stringify([seq, at.toISOString(), 'System', action, objectType, objectId, detail]));
  await tx.insert(s.auditLog).values({ seq, at, actorName: 'System', action, objectType, objectId, detail, prevHash: prev, hash });
}


async function main() {
  await db.transaction(async tx => {
    // 1. Roles (only missing ones; admins may have edited existing ones)
    const have = await tx.select({ name: s.roles.name }).from(s.roles);
    for (const r of DEFAULT_ROLES) if (!have.some(h => h.name === r.name)) {
      await tx.insert(s.roles).values({ name: r.name, org: r.org, permissions: r.permissions, requireMfa: r.requireMfa, system: true });
      await audit(tx, 'Role created', 'role', r.name, `Built-in role with ${r.permissions.length} permissions`);
    }
    // 1b. One-time upgrade: grant permissions added in v2 (funding and performance) to existing built-in roles.
    const done = (await tx.select().from(s.counters).where(eq(s.counters.name, 'perms_v2')))[0];
    if (!done) {
      for (const [name, add] of Object.entries(PERMS_V2)) {
        const r = (await tx.select().from(s.roles).where(eq(s.roles.name, name)))[0];
        if (r) { const next = [...new Set([...r.permissions, ...(add ?? [])])]; if (next.length !== r.permissions.length) await tx.update(s.roles).set({ permissions: next }).where(eq(s.roles.id, r.id)); }
      }
      await tx.insert(s.counters).values({ name: 'perms_v2', value: 1 });
      if (have.length) await audit(tx, 'Role permissions changed', 'role', 'roles', 'Upgrade: funding and performance permissions granted to built-in roles');
    }
    // 2. Rules
    const rs = await tx.select().from(s.ruleSets).limit(1);
    if (!rs.length) { await tx.insert(s.ruleSets).values({ values: DEFAULT_RULES, createdBy: 'System' }); await audit(tx, 'Rules created', 'rules', '1', 'Default approval rules'); }

    // 3. First admin
    const adminRole = (await tx.select().from(s.roles).where(eq(s.roles.name, 'Admin')))[0];
    const anyAdmin = (await tx.execute(sql`select u.id from users u join roles r on r.id = u.role_id where 'manage_users' = any(r.permissions) and u.status = 'ACTIVE' and not u.demo limit 1`)).rows;
    if (!anyAdmin.length) {
      const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      if (!email) throw new Error('Set ADMIN_EMAIL so the first admin account can be created.');
      let pw = process.env.ADMIN_PASSWORD || '';
      const generated = !pw;
      if (generated) pw = 'Fl-' + randomBytes(12).toString('base64url') + '9!';
      const existing = (await tx.select().from(s.users).where(eq(s.users.email, email)))[0];
      if (existing) await tx.update(s.users).set({ roleId: adminRole.id, status: 'ACTIVE', passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true, passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(s.users.id, existing.id));
      else await tx.insert(s.users).values({ email, name: process.env.ADMIN_NAME || 'Fundline Admin', passwordHash: await bcrypt.hash(pw, 12), roleId: adminRole.id, mustChangePassword: true, passwordChangedAt: new Date() });
      await audit(tx, 'Admin account created', 'user', email, 'First admin created at startup; password change and MFA setup required at first sign-in');
      console.log(`[seed] Admin account: ${email}`);
      if (generated) console.log(`[seed] Temporary admin password (shown once, change it at first sign-in): ${pw}`);
    }

    // 4. Demo data (only into an empty database)
    if ((process.env.SEED_DEMO ?? 'true') === 'true') {
      const vcount = (await tx.select({ n: sql<number>`count(*)::int` }).from(s.vendors))[0].n;
      if (vcount === 0) {
        const summary = await loadDemoData(tx);
        await audit(tx, 'Demo data loaded', 'system', 'seed', `${summary} (fictional Northfield Market)`);
        console.log('[seed] Demo data loaded');
      }
    }

    // 5. Shared demo accounts, one per built-in role
    if (demoEnabled()) {
      const envPw = (process.env.DEMO_PASSWORD || '').trim();
      if (envPw) { const problem = passwordProblem(envPw); if (problem) console.warn(`[seed] DEMO_PASSWORD is weak: ${problem}`); }
      const existing = (await tx.select().from(s.users).where(eq(s.users.demo, true)).limit(1))[0];
      // Re-hash only when DEMO_PASSWORD is set and differs from what's stored, so restarts don't sign testers out.
      const rotate = !!envPw && (!existing || !(await bcrypt.compare(envPw, existing.passwordHash)));
      const generated = !envPw && !existing ? 'Demo-' + randomBytes(9).toString('base64url') + '7!' : '';
      const pw = envPw || generated;
      const hash = pw ? await bcrypt.hash(pw, 12) : existing!.passwordHash;
      const created = await ensureDemoUsers(tx, hash, rotate);
      if (created.length || rotate) await audit(tx, rotate && !created.length ? 'Demo password changed' : 'Demo accounts created', 'system', 'demo', `${created.length} created${rotate ? '; shared password set from DEMO_PASSWORD' : ''}`);
      console.log(`[seed] Demo accounts on (${created.length} created)`);
      if (generated) console.log(`[seed] Shared demo password (shown once; set DEMO_PASSWORD to choose your own): ${generated}`);
    } else {
      const n = await disableDemoUsers(tx);
      if (n) { await audit(tx, 'Demo accounts disabled', 'system', 'demo', `${n} demo accounts deactivated (DEMO_ACCOUNTS=false)`); console.log(`[seed] ${n} demo accounts deactivated`); }
    }
  });
  await pool.end();
  console.log('[seed] done');
}
main().catch(async e => { console.error('[seed] failed', e); await pool.end(); process.exit(1); });
