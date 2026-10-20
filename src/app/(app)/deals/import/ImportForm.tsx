'use client';
import { useActionState } from 'react';
import { importCaissp, type ImportState } from '../actions';

export function ImportForm({ vendors, events }: { vendors: { id: string; name: string; number: string }[]; events: { id: string; name: string; startDate: string }[] }) {
  const [s, a, p] = useActionState<ImportState, FormData>(importCaissp, undefined);
  return (
    <form action={a} className="form">
      <div className="field"><label htmlFor="file">CAISSP workbook (.xlsx, up to 5 MB)</label><input id="file" name="file" type="file" accept=".xlsx,.xlsm" required /></div>
      <div className="fgrid">
        {vendors.length > 0 && <div className="field"><label htmlFor="vendorId">Vendor</label><select id="vendorId" name="vendorId" defaultValue=""><option value="">Match by vendor number in the file</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name} · #{v.number}</option>)}</select></div>}
        <div className="field"><label htmlFor="eventId">Event</label><select id="eventId" name="eventId" defaultValue=""><option value="">Match by the allowance dates in the file</option>{events.map(e => <option key={e.id} value={e.id}>{e.name} · {e.startDate}</option>)}</select></div>
      </div>
      {s?.error && <p className="flash err" role="alert">{s.error}</p>}
      <div><button className="btn primary" disabled={p}>{p ? 'Reading the file…' : 'Import as a draft'}</button></div>
    </form>
  );
}
