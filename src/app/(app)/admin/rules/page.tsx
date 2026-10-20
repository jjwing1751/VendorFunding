import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { ruleSets } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { currentRules } from '@/lib/data';
import { RULE_FIELDS } from '@/lib/economics';
import { fdatetime } from '@/lib/format';
import { Flash, PageHead } from '@/components/ui';
import { saveRules } from '../actions';

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'edit_rules')) return <PageHead title="Approval rules" sub={`Your role (${me.role.name}) can’t change rules.`} />;
  const { values, version } = await currentRules();
  const history = await db.select().from(ruleSets).orderBy(desc(ruleSets.version)).limit(10);
  return (
    <>
      <PageHead title="Approval rules" sub={`Version ${version}. Saving creates a new version; every decision records the version it used.`} />
      <Flash sp={await searchParams} />
      <section className="panel"><div className="panel-b"><form action={saveRules} className="form"><div className="fgrid">
        {RULE_FIELDS.map(f => f.kind === 'bool'
          ? <label key={f.key} className="check" style={{ gridColumn: '1 / -1' }}><input type="checkbox" name={f.key} defaultChecked={values[f.key] as boolean} /> {f.label}</label>
          : <div className="field" key={f.key}><label htmlFor={f.key}>{f.label}{f.kind === 'pct' ? ' (%)' : ''}</label><input id={f.key} name={f.key} inputMode="decimal" defaultValue={f.kind === 'pct' ? +((values[f.key] as number) * 100).toFixed(2) : values[f.key] as number} /></div>)}
      </div><div><button className="btn primary">Save as new version</button></div></form></div></section>
      <section className="panel"><div className="panel-h"><h2>History</h2></div><div className="list">{history.map(h => <div className="li" key={h.version}><div className="grow"><div className="t">Version {h.version}</div><div className="d">{h.createdBy} · {fdatetime(h.createdAt)}</div></div></div>)}</div></section>
    </>
  );
}
