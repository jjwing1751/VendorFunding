import { asc, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog } from '@/db/schema';
import { sha256 } from './crypto';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type AuditInput = { actorId?: string | null; actorName: string; action: string; objectType: string; objectId: string; detail?: string; ip?: string | null };

const GENESIS = '0'.repeat(64);
const AUDIT_LOCK = 734_221; // advisory lock key that serializes appends to the hash chain

function hashOf(prev: string, e: { seq: number; at: string; actorName: string; action: string; objectType: string; objectId: string; detail: string }) {
  return sha256(prev + '|' + JSON.stringify([e.seq, e.at, e.actorName, e.action, e.objectType, e.objectId, e.detail]));
}

/** Append one entry to the tamper-evident audit chain. Call inside the same transaction as the change it records. */
export async function audit(tx: Tx | typeof db, a: AuditInput) {
  const run = async (t: Tx) => {
    await t.execute(sql`select pg_advisory_xact_lock(${AUDIT_LOCK})`);
    const last = await t.select({ seq: auditLog.seq, hash: auditLog.hash }).from(auditLog).orderBy(desc(auditLog.seq)).limit(1);
    const prev = last[0]?.hash ?? GENESIS;
    const seq = (last[0]?.seq ?? 0) + 1;
    const at = new Date();
    const detail = (a.detail ?? '').slice(0, 2000);
    const hash = hashOf(prev, { seq, at: at.toISOString(), actorName: a.actorName, action: a.action, objectType: a.objectType, objectId: a.objectId, detail });
    await t.insert(auditLog).values({ seq, at, actorId: a.actorId ?? null, actorName: a.actorName, action: a.action, objectType: a.objectType, objectId: a.objectId, detail, ip: a.ip ?? null, prevHash: prev, hash });
  };
  if ('rollback' in tx) return run(tx as Tx);
  return (tx as typeof db).transaction(run);
}

export async function verifyChain() {
  const rows = await db.select().from(auditLog).orderBy(asc(auditLog.seq));
  let prev = GENESIS;
  for (const r of rows) {
    const h = hashOf(prev, { seq: r.seq, at: r.at.toISOString(), actorName: r.actorName, action: r.action, objectType: r.objectType, objectId: r.objectId, detail: r.detail });
    if (r.prevHash !== prev || r.hash !== h) return { ok: false as const, brokenAt: r.seq, count: rows.length };
    prev = r.hash;
  }
  return { ok: true as const, count: rows.length, head: prev };
}
