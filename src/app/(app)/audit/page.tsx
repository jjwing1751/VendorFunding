import { and, desc, ilike, lt, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { verifyChain } from '@/lib/audit';
import { PageHead } from '@/components/ui';

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; before?: string; verify?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'view_audit')) return <PageHead title="Audit trail" sub={`Your role (${me.role.name}) can’t view the audit trail.`} />;
  const sp = await searchParams;
  const w: SQL[] = [];
  if (sp.q) { const q = `%${sp.q.slice(0, 80)}%`; w.push(or(ilike(auditLog.action, q), ilike(auditLog.actorName, q), ilike(auditLog.objectId, q), ilike(auditLog.detail, q))!); }
  const before = Number(sp.before); if (before > 0) w.push(lt(auditLog.seq, before));
  const rows = await db.select().from(auditLog).where(w.length ? and(...w) : undefined).orderBy(desc(auditLog.seq)).limit(100);
  const v = sp.verify ? await verifyChain() : null;
  return (
    <>
      <PageHead title="Audit trail" sub="Append-only record of sign-ins, decisions, contract changes, rule changes and admin actions. Each entry includes a SHA-256 hash of the one before it, so any edit to history breaks the chain.">
        <a className="btn primary" href="/audit?verify=1">Verify chain</a>
      </PageHead>
      {v && (v.ok ? <p className="flash ok">Chain intact: {v.count} entries verified. Head hash {v.head.slice(0, 16)}…</p> : <p className="flash err">Chain broken at entry #{v.brokenAt}. An entry was changed after it was written.</p>)}
      <form className="toolbar" method="get"><input className="inp" name="q" defaultValue={sp.q ?? ''} placeholder="Search action, person, deal number, detail" style={{ maxWidth: 360 }} aria-label="Search audit trail" /><button className="btn sm">Search</button></form>
      <section className="panel"><div className="tbl"><table><thead><tr><th className="num">#</th><th>Time (UTC)</th><th>Who</th><th>Action</th><th>Object</th><th>Detail</th><th>Network</th><th>Hash</th></tr></thead><tbody>
        {rows.map(a => <tr key={a.seq}><td className="num small">{a.seq}</td><td className="mono small" style={{ whiteSpace: 'nowrap' }}>{a.at.toISOString().slice(0, 16).replace('T', ' ')}</td><td className="small">{a.actorName}</td><td><b className="small">{a.action}</b></td><td className="mono small">{a.objectType}:{a.objectId}</td><td className="small">{a.detail}</td><td className="mono small">{a.ip ?? ''}</td><td className="mono small">{a.hash.slice(0, 10)}</td></tr>)}
      </tbody></table></div></section>
      {rows.length === 100 && <a className="btn" href={`/audit?before=${rows[rows.length - 1].seq}${sp.q ? '&q=' + encodeURIComponent(sp.q) : ''}`}>Older entries</a>}
    </>
  );
}
