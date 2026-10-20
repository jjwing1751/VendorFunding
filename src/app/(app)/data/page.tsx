import { desc, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { dataUploads } from '@/db/schema';
import { can, isVendorUser, requireUser } from '@/lib/auth';
import { fdate, fdatetime, num } from '@/lib/format';
import { dataCoverage } from '@/lib/measure-data';
import { PageHead } from '@/components/ui';
import { UploadForm } from '@/components/UploadForm';
import { uploadActuals } from './actions';

export default async function DataPage() {
  const me = await requireUser();
  if (isVendorUser(me) || !(can(me, 'upload_actuals') || can(me, 'view_performance'))) return <PageHead title="Sales & receipts data" sub={`Your role (${me.role.name}) can’t see uploaded data.`} />;
  const cov = await dataCoverage();
  const ups = await db.select().from(dataUploads).where(inArray(dataUploads.kind, ['SALES', 'RECEIPTS'])).orderBy(desc(dataUploads.createdAt)).limit(15);
  return (
    <>
      <PageHead title="Sales & receipts data" sub="Actuals by UPC and week. Sales drive earned scan and bill-back funding and event lift; receipts (purchases) drive accrual earnings." />
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Sales loaded</div><div className="v">{cov.sales.through ? fdate(cov.sales.through) : 'None'}</div><div className="s">{cov.sales.first ? `from week of ${fdate(cov.sales.first)} · ${num(cov.sales.n)} UPC-weeks · ${cov.sales.upcs} UPCs` : 'Upload a POS export to measure lift'}</div></div>
        <div className="kpi"><div className="eyebrow">Receipts loaded</div><div className="v">{cov.receipts.through ? fdate(cov.receipts.through) : 'None'}</div><div className="s">{cov.receipts.first ? `from week of ${fdate(cov.receipts.first)} · ${num(cov.receipts.n)} UPC-weeks · ${cov.receipts.upcs} UPCs` : 'Upload receiving data to track accruals'}</div></div>
      </div>
      {can(me, 'upload_actuals') && <section className="panel"><div className="panel-h"><h2>Upload a file</h2><a className="small" href="/api/export/template-sales.csv">Sales template</a><a className="small" href="/api/export/template-receipts.csv">Receipts template</a></div><div className="panel-b">
        <UploadForm id="actuals" action={uploadActuals} kinds={[{ value: 'SALES', label: 'POS sales: UPC, week, units, sales $' }, { value: 'RECEIPTS', label: 'Receipts: UPC, week, cases, cost $' }]} button="Upload" />
        <ul className="hint" style={{ marginBottom: 0, paddingLeft: 18 }}>
          <li>One row per UPC per week. Any date in the week works (week start or week ending); Fundline files it under that week’s Monday.</li>
          <li>Several rows for the same UPC and week (for example one per store) are added together. Uploading a UPC-week again replaces it, so corrected files are safe to re-send.</li>
          <li>UPCs are matched to the item master with or without dashes and leading zeros. Rows for UPCs that aren’t set up are skipped and listed.</li>
          <li>Receipts without a cost column use cases × the case cost on file.</li>
        </ul>
      </div></section>}
      <section className="panel"><div className="panel-h"><h2>Upload history</h2></div><div className="tbl"><table><thead><tr><th>When</th><th>Type</th><th>File</th><th className="num">Rows</th><th className="num">Skipped</th><th>Covers</th><th>By</th></tr></thead><tbody>
        {ups.map(u => <tr key={u.id}><td className="small">{fdatetime(u.createdAt)}</td><td><span className="pill">{u.kind === 'SALES' ? 'Sales' : 'Receipts'}</span></td><td className="small">{u.fileName}</td><td className="num">{num(u.rows)}</td><td className="num">{u.skipped || '—'}</td><td className="small">{u.notes}</td><td className="small">{u.byName.split(' (')[0]}</td></tr>)}
        {!ups.length && <tr><td colSpan={7} className="empty">Nothing uploaded yet.</td></tr>}
      </tbody></table></div></section>
    </>
  );
}
