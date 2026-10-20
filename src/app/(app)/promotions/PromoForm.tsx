'use client';
import { useActionState, useState } from 'react';
import { savePromotion, type PromoState } from './actions';

type It = { upc: string; description: string; regularRetail: number; unitCost: number; vendorId: string | null };
const REASONS = ['Own brand', 'Fresh / seasonal', 'Loss leader', 'Competitive price match', 'Vendor declined to fund', 'Other'];

export function PromoForm({ events, vendors, items }: { events: { id: string; name: string; startDate: string }[]; vendors: { id: string; name: string }[]; items: It[] }) {
  const [s, a, p] = useActionState<PromoState, FormData>(savePromotion, undefined);
  const [eventId, setEvent] = useState(events[0]?.id ?? '');
  const [name, setName] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [brand, setBrand] = useState('');
  const [sel, setSel] = useState<Record<string, string>>({});
  const list = items.filter(i => (i.vendorId ?? '') === brand);
  const payload = { eventId, name, reason, brandVendorId: brand || null, lines: Object.entries(sel).map(([upc, v]) => ({ upc, promoRetail: v })) };
  return (
    <form action={a} className="form">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="fgrid">
        <div className="field"><label htmlFor="ev">Event</label><select id="ev" value={eventId} onChange={e => setEvent(e.target.value)}>{events.map(e => <option key={e.id} value={e.id}>{e.name} · {e.startDate}</option>)}</select></div>
        <div className="field"><label htmlFor="reason">Why the retailer funds it</label><select id="reason" value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label htmlFor="brand">Brand owner</label><select id="brand" value={brand} onChange={e => { setBrand(e.target.value); setSel({}); }}><option value="">Own brand, fresh or meat</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div className="field"><label htmlFor="name">Offer name</label><input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Frozen vegetables 10 for $10" maxLength={120} /></div>
      </div>
      <div className="tbl"><table><thead><tr><th></th><th>UPC</th><th>Item</th><th className="num">Unit cost</th><th className="num">Regular retail</th><th className="num">Promo retail</th></tr></thead><tbody>
        {list.map(i => { const on = sel[i.upc] != null; return <tr key={i.upc}>
          <td><input type="checkbox" aria-label={`Include ${i.description}`} checked={on} onChange={e => setSel(x => { const n = { ...x }; if (e.target.checked) n[i.upc] = (i.regularRetail * 0.75).toFixed(2); else delete n[i.upc]; return n; })} /></td>
          <td className="mono small">{i.upc}</td><td className="small">{i.description}</td><td className="num">${i.unitCost.toFixed(2)}</td><td className="num">${i.regularRetail.toFixed(2)}</td>
          <td className="num"><input className="inp" style={{ width: 90, textAlign: 'right' }} aria-label={`Promo retail for ${i.description}`} disabled={!on} value={sel[i.upc] ?? ''} onChange={e => setSel(x => ({ ...x, [i.upc]: e.target.value }))} /></td></tr>; })}
      </tbody></table>{!list.length && <p className="hint">No items for this brand owner in the item master.</p>}</div>
      {s?.error && <p className="flash err" role="alert">{s.error}</p>}
      <div><button className="btn primary" disabled={p}>Add promotion</button></div>
    </form>
  );
}
