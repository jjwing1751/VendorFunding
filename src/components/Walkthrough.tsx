import Link from 'next/link';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog, deals, guideProgress } from '@/db/schema';
import type { Me } from '@/lib/auth';
import { guideFor } from '@/lib/guides';
import { markStep, restartGuide, unmarkStep } from '@/app/(app)/guide/actions';

/** Role walkthrough. `from` decides where the mark-done buttons return to. */
export async function Walkthrough({ me, from }: { me: Me; from: 'home' | 'guide' }) {
  const g = guideFor(me.role.name);
  if (!g) return null;
  const since = me.user.guideStartedAt ?? me.user.createdAt;
  const autoActions = [...new Set(g.steps.flatMap(s => s.auto ?? []))];
  const done = new Set<string>();
  const doneBy = new Map<string, string>();
  if (autoActions.length) {
    const acts = await db.selectDistinct({ action: auditLog.action }).from(auditLog)
      .where(and(eq(auditLog.actorId, me.user.id), gte(auditLog.at, since), inArray(auditLog.action, autoActions)));
    const have = new Set(acts.map(a => a.action));
    for (const s of g.steps) if (s.auto?.some(a => have.has(a))) { done.add(s.key); doneBy.set(s.key, 'auto'); }
  }
  const manual = await db.select().from(guideProgress).where(eq(guideProgress.userId, me.user.id));
  for (const m of manual) if (!done.has(m.stepKey)) { done.add(m.stepKey); doneBy.set(m.stepKey, 'manual'); }

  const nums = g.steps.map(s => s.deal).filter((x): x is string => !!x);
  const dealRows = nums.length ? await db.select({ id: deals.id, number: deals.number, vendorId: deals.vendorId }).from(deals).where(inArray(deals.number, nums)) : [];
  const hrefOf = (s: (typeof g.steps)[number]) => {
    const d = s.deal ? dealRows.find(r => r.number === s.deal && (!me.vendor || r.vendorId === me.vendor.id)) : null;
    return d ? `/deals/${d.id}` : s.href;
  };
  const next = g.steps.find(s => !done.has(s.key));
  const n = g.steps.filter(s => done.has(s.key)).length;
  const pct = Math.round(n / g.steps.length * 100);

  return (
    <section className="panel guide" aria-labelledby="guide-h">
      <div className="panel-h">
        <h2 id="guide-h">Walkthrough: {me.role.name}</h2>
        <span className={`pill ${n === g.steps.length ? 'good' : 'acc'}`}>{n} of {g.steps.length} done</span>
        <form action={restartGuide}><input type="hidden" name="from" value={from} /><button className="btn sm">Restart</button></form>
      </div>
      <div className="panel-b" style={{ paddingBottom: 6 }}>
        <p style={{ margin: '0 0 10px' }}>{g.goal}</p>
        <div className="gbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Walkthrough progress"><i style={{ width: `${pct}%` }} /></div>
      </div>
      <ol className="steps">
        {g.steps.map((s, i) => {
          const isDone = done.has(s.key); const isNext = next?.key === s.key;
          return (
            <li key={s.key} className={`step${isDone ? ' done' : ''}${isNext ? ' next' : ''}`}>
              <span className="stepn" aria-hidden>{isDone ? '✓' : i + 1}</span>
              <div className="grow">
                <div className="t">{s.title}{isDone && <span className="sr-only"> (done)</span>}</div>
                <div className="d">{s.detail}</div>
                {isDone && doneBy.get(s.key) === 'auto' && <div className="hint">Done: we saw it in the audit trail.</div>}
              </div>
              <div className="step-actions">
                <Link className={`btn sm${isNext ? ' primary' : ''}`} href={hrefOf(s)}>{s.cta}</Link>
                {isDone
                  ? doneBy.get(s.key) === 'manual' && <form action={unmarkStep}><input type="hidden" name="step" value={s.key} /><input type="hidden" name="from" value={from} /><button className="linkbtn small">Undo</button></form>
                  : <form action={markStep}><input type="hidden" name="step" value={s.key} /><input type="hidden" name="from" value={from} /><button className="linkbtn small">Mark done</button></form>}
              </div>
            </li>
          );
        })}
      </ol>
      {n === g.steps.length && <div className="panel-b hint">That’s the whole {me.role.name.toLowerCase()} workflow. Tell the Fundline team what was confusing or missing.</div>}
    </section>
  );
}
