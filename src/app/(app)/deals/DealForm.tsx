'use client';
import { useActionState, useMemo, useState } from 'react';
import { classifyFunding, dealEcon, lineCalc } from '@/lib/economics';
import { saveDeal, type DealPayload, type SaveState } from './actions';

export type ItemOpt = { upc: string; description: string; casePack: number; caseCost: number; regularRetail: number; baseWeeklyUnits: number; vendorId: string | null };
type EventOpt = { id: string; name: string; startDate: string; endDate: string; status: string; cutoff: string };
type VendorOpt = { id: string; name: string; number: string };
type Line = { upc: string; cmap: string; tpr: string; ad: string; billBack: string; wholesalerScan: string; retailerScan: string; zone3Retail: string; zone4Retail: string; zone5Retail: string; loyaltyMulti: string };

const PERIODS: [keyof NonNullable<DealPayload['periods']>, string, string][] = [
  ['amap', 'CMAP / AMAP off-invoice', 'Wholesaler program, per case'], ['tpr', 'TPR off-invoice', 'Retailer only, per case'], ['ad', 'Ad off-invoice', 'Retailer only, per case'],
  ['bb', 'Bill-back', 'Billed per case purchased'], ['wscan', 'Wholesaler unit scan', 'Per unit, claimed via wholesaler'], ['rscan', 'Unit scan', 'Per unit, billed to vendor'],
];
const HEADER: [string, string][] = [['broker', 'Vendor / broker'], ['salesperson', 'Salesperson'], ['phone', 'Phone'], ['email', 'Email'], ['billingCompany', 'Billing company'], ['billingContact', 'Billing contact'], ['billingEmail', 'Billing email'], ['promotion', 'Promotion'], ['adRunDates', 'Ad run dates'], ['aimContract', 'AIM contract #']];
const blank = (upc = ''): Line => ({ upc, cmap: '', tpr: '', ad: '', billBack: '', wholesalerScan: '', retailerScan: '', zone3Retail: '', zone4Retail: '', zone5Retail: '', loyaltyMulti: '' });
const f = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
const m2 = (n: number) => '$' + n.toFixed(2);

export function DealForm({ mode, vendors, events, items, initial, dealId, threshold }: {
  mode: 'vendor' | 'retailer'; vendors: VendorOpt[]; events: EventOpt[]; items: ItemOpt[];
  initial: { vendorId?: string; eventId?: string; title?: string; header?: Record<string, string>; periods?: Record<string, { start: string; end: string }>; storeGroups?: string[]; adFee?: number; accrualPct?: number; forecastUnits?: number | null; signer?: string | null; lines?: Partial<Record<keyof Line, string | number | null>>[] };
  dealId?: string; threshold: number;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDeal, undefined);
  const [vendorId, setVendorId] = useState(initial.vendorId ?? (mode === 'vendor' ? '' : vendors[0]?.id ?? ''));
  const [eventId, setEventId] = useState(initial.eventId ?? events[0]?.id ?? '');
  const [title, setTitle] = useState(initial.title ?? '');
  const [header, setHeader] = useState<Record<string, string>>(initial.header ?? {});
  const [periods, setPeriods] = useState<Record<string, { start: string; end: string }>>(initial.periods ?? {});
  const [stores, setStores] = useState((initial.storeGroups ?? ['All stores']).join(', '));
  const [adFee, setAdFee] = useState(String(initial.adFee ?? ''));
  const [accr, setAccr] = useState(initial.accrualPct ? String(initial.accrualPct * 100) : '');
  const [fc, setFc] = useState(initial.forecastUnits ? String(initial.forecastUnits) : '');
  const [signer, setSigner] = useState(initial.signer ?? '');
  const [lines, setLines] = useState<Line[]>(initial.lines?.length ? initial.lines.map(l => ({ ...blank(), ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v == null || v === 0 ? '' : String(v)])) } as Line)) : [blank()]);
  const ev = events.find(e => e.id === eventId);
  const myItems = useMemo(() => items.filter(i => mode === 'vendor' || i.vendorId === vendorId), [items, vendorId, mode]);
  const find = (u: string) => myItems.find(i => i.upc === u) ?? myItems.find(i => i.upc.replace(/\D/g, '').replace(/^0+/, '') === u.replace(/\D/g, '').replace(/^0+/, ''));
  const set = (i: number, k: keyof Line, v: string) => setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const resolved = lines.map(l => ({ l, it: l.upc ? find(l.upc) : undefined }));
  const econ = useMemo(() => {
    const ok = resolved.filter(r => r.it);
    if (!ok.length || !ev) return null;
    const ps = Object.values(periods).filter(p => p.start);
    const start = ps.length ? ps.map(p => p.start).sort()[0] : ev.startDate, end = ps.length ? ps.map(p => p.end || p.start).sort().slice(-1)[0] : ev.endDate;
    return dealEcon({ startDate: start, endDate: end, adFee: f(adFee), accrualPct: f(accr) / 100, forecastUnits: f(fc) || null,
      lines: ok.map(({ l, it }) => ({ upc: it!.upc, casePack: it!.casePack, caseCost: it!.caseCost, regularRetail: it!.regularRetail, baseWeeklyUnits: it!.baseWeeklyUnits,
        cmap: f(l.cmap), tpr: f(l.tpr), ad: f(l.ad), billBack: f(l.billBack), wholesalerScan: f(l.wholesalerScan), retailerScan: f(l.retailerScan),
        zone3Retail: f(l.zone3Retail) || null, zone4Retail: f(l.zone4Retail) || null, zone5Retail: f(l.zone5Retail) || null })) });
  }, [resolved, periods, adFee, accr, fc, ev]);
  const fund = econ ? classifyFunding(econ.markdown, econ.totalFunds, threshold) : null;

  const payload: DealPayload = {
    vendorId: mode === 'retailer' ? vendorId : undefined, eventId, title, header, periods: Object.fromEntries(Object.entries(periods).filter(([, p]) => p.start)) as DealPayload['periods'],
    storeGroups: stores.split(',').map(s => s.trim()).filter(Boolean), adFee: f(adFee), accrualPct: f(accr) / 100, forecastUnits: fc ? f(fc) : null, signer,
    lines: lines.filter(l => l.upc.trim()).map(l => ({ upc: l.upc.trim(), cmap: f(l.cmap), tpr: f(l.tpr), ad: f(l.ad), billBack: f(l.billBack), wholesalerScan: f(l.wholesalerScan), retailerScan: f(l.retailerScan),
      zone3Retail: l.zone3Retail ? f(l.zone3Retail) : null, zone4Retail: l.zone4Retail ? f(l.zone4Retail) : null, zone5Retail: l.zone5Retail ? f(l.zone5Retail) : null, loyaltyMulti: l.loyaltyMulti || null })),
  };
  const num = (i: number, k: keyof Line, label: string) => <input aria-label={`${label}, line ${i + 1}`} inputMode="decimal" value={lines[i][k]} onChange={e => set(i, k, e.target.value)} />;

  return (
    <form action={action} className="form">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      <section className="panel"><div className="panel-h"><h2>Contract</h2></div><div className="panel-b form">
        <div className="fgrid">
          {mode === 'retailer' && <div className="field"><label htmlFor="vendor">Vendor</label><select id="vendor" value={vendorId} onChange={e => { setVendorId(e.target.value); setLines([blank()]); }}>{vendors.map(v => <option key={v.id} value={v.id}>{v.name} · #{v.number}</option>)}</select></div>}
          <div className="field"><label htmlFor="event">Event</label><select id="event" value={eventId} onChange={e => setEventId(e.target.value)}>{events.map(e => <option key={e.id} value={e.id}>{e.name} · {e.startDate} · cutoff {e.cutoff}{e.status !== 'PLANNING' ? ` (${e.status.toLowerCase()})` : ''}</option>)}</select></div>
          <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="title">Deal title</label><input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Holiday kettle chips endcap" maxLength={120} /></div>
        </div>
        <div className="fgrid">{HEADER.map(([k, l]) => <div className="field" key={k}><label htmlFor={`h_${k}`}>{l}</label><input id={`h_${k}`} value={header[k] ?? ''} onChange={e => setHeader(h => ({ ...h, [k]: e.target.value }))} maxLength={160} /></div>)}</div>
        <div className="field"><label htmlFor="feature">Feature description</label><input id="feature" value={header.feature ?? ''} onChange={e => setHeader(h => ({ ...h, feature: e.target.value }))} maxLength={400} /></div>
        <div className="grid2">
          <div><div className="lbl small muted" style={{ marginBottom: 6, fontWeight: 600 }}>Allowance periods</div>
            <div className="tbl"><table><thead><tr><th>Allowance</th><th>Start</th><th>End</th></tr></thead><tbody>
              {PERIODS.map(([k, l, h]) => <tr key={k}><td><b className="small">{l}</b><div className="hint">{h}</div></td>
                <td><input className="inp" type="date" aria-label={`${l} start`} value={periods[k]?.start ?? ''} onChange={e => setPeriods(p => ({ ...p, [k]: { start: e.target.value, end: p[k]?.end || e.target.value } }))} /></td>
                <td><input className="inp" type="date" aria-label={`${l} end`} value={periods[k]?.end ?? ''} onChange={e => setPeriods(p => ({ ...p, [k]: { start: p[k]?.start || e.target.value, end: e.target.value } }))} /></td></tr>)}
            </tbody></table></div>
            {ev && <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => setPeriods(p => Object.fromEntries(Object.entries(p).map(([k]) => [k, { start: ev.startDate, end: ev.endDate }])))}>Match filled periods to the event dates</button>}
          </div>
          <div className="form">
            <div className="field"><label htmlFor="stores">Store groups (comma-separated)</label><input id="stores" value={stores} onChange={e => setStores(e.target.value)} /></div>
            <div className="fgrid">
              <div className="field"><label htmlFor="adfee">Ad fee / lump sum ($)</label><input id="adfee" inputMode="decimal" value={adFee} onChange={e => setAdFee(e.target.value)} /></div>
              <div className="field"><label htmlFor="accr">Accrual (% of purchases)</label><input id="accr" inputMode="decimal" value={accr} onChange={e => setAccr(e.target.value)} /></div>
              <div className="field"><label htmlFor="fc">Your forecast units (optional)</label><input id="fc" inputMode="numeric" value={fc} onChange={e => setFc(e.target.value)} /></div>
            </div>
            <div className="field"><label htmlFor="signer">Authorized signer</label><input id="signer" value={signer} onChange={e => setSigner(e.target.value)} maxLength={120} placeholder="Name of the person signing for the vendor" /></div>
          </div>
        </div>
      </div></section>

      <section className="panel"><div className="panel-h"><h2>UPC lines</h2><span className="hint">Off-invoice and bill-back are per case. Scans are per unit. Retails are promo prices by price zone.</span></div>
        <datalist id="upcs">{myItems.map(i => <option key={i.upc} value={i.upc}>{i.description}</option>)}</datalist>
        <div className="tbl"><table className="lines"><thead><tr><th>UPC</th><th>Description</th><th className="num">Pack</th><th className="num">Case cost</th><th className="num">CMAP / AMAP</th><th className="num">TPR</th><th className="num">Ad</th><th className="num">Total OI</th><th className="num">Bill-back</th><th className="num">Whsl scan</th><th className="num">Unit scan</th><th className="num">Deal case cost</th><th className="num">Net unit cost</th><th className="num">Reg retail</th><th className="num">Zone 3</th><th className="num">Zone 4</th><th className="num">Zone 5</th><th>Funded</th><th></th></tr></thead>
          <tbody>{resolved.map(({ l, it }, i) => {
            const c = it ? lineCalc({ upc: it.upc, casePack: it.casePack, caseCost: it.caseCost, regularRetail: it.regularRetail, baseWeeklyUnits: it.baseWeeklyUnits, cmap: f(l.cmap), tpr: f(l.tpr), ad: f(l.ad), billBack: f(l.billBack), wholesalerScan: f(l.wholesalerScan), retailerScan: f(l.retailerScan), zone3Retail: f(l.zone3Retail) || null, zone4Retail: f(l.zone4Retail) || null, zone5Retail: f(l.zone5Retail) || null }) : null;
            const sh = c && c.markdownPU > 0 ? (c.vendorPU + c.whPU) / c.markdownPU : null;
            return <tr key={i}>
              <td><input className="upc" list="upcs" aria-label={`UPC line ${i + 1}`} value={l.upc} onChange={e => set(i, 'upc', e.target.value)} />{l.upc && !it && <div className="err small">Not one of this vendor’s items</div>}</td>
              <td className="small" style={{ minWidth: 180 }}>{it?.description ?? '—'}</td><td className="num">{it?.casePack ?? ''}</td><td className="num">{it ? m2(it.caseCost) : ''}</td>
              <td>{num(i, 'cmap', 'CMAP')}</td><td>{num(i, 'tpr', 'TPR')}</td><td>{num(i, 'ad', 'Ad deal')}</td><td className="num">{c ? m2(c.totOI) : ''}</td>
              <td>{num(i, 'billBack', 'Bill-back')}</td><td>{num(i, 'wholesalerScan', 'Wholesaler scan')}</td><td>{num(i, 'retailerScan', 'Unit scan')}</td>
              <td className="num">{c ? m2(c.dealCaseCost) : ''}</td><td className="num">{c ? m2(c.netUnitCost) : ''}</td><td className="num">{it ? m2(it.regularRetail) : ''}</td>
              <td>{num(i, 'zone3Retail', 'Zone 3 retail')}</td><td>{num(i, 'zone4Retail', 'Zone 4 retail')}</td><td>{num(i, 'zone5Retail', 'Zone 5 retail')}</td>
              <td>{sh == null ? '' : <span className={`pill ${sh >= threshold ? 'good' : sh > 0 ? 'warn' : ''}`}>{Math.round(sh * 100)}%</span>}</td>
              <td><button type="button" className="btn sm" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : [blank()])}>×</button></td></tr>;
          })}</tbody></table></div>
        <div className="panel-b actions"><button type="button" className="btn sm" onClick={() => setLines(ls => [...ls, blank()])}>Add line</button>
          <button type="button" className="btn sm" onClick={() => setLines(ls => { const have = new Set(ls.map(l => l.upc)); const keep = ls.filter(l => l.upc); return [...keep, ...myItems.filter(i => !have.has(i.upc)).map(i => blank(i.upc))]; })}>Add all of this vendor’s items</button></div>
      </section>

      {econ && <section className="panel"><div className="panel-h"><h2>Preview</h2>{fund && <span className={`pill ${fund.cls === 'Vendor funded' ? 'good' : fund.cls === 'Shared' ? 'warn' : ''}`}>{fund.cls}{fund.cls === 'Shared' ? ` ${Math.round(fund.share * 100)}%` : ''}</span>}</div>
        <div className="panel-b"><div className="econ">
          <div><span className="eyebrow">Weighted net cost</span><b>{m2(econ.netCost)}</b></div><div><span className="eyebrow">Promo retail</span><b>{m2(econ.promo)}</b></div><div><span className="eyebrow">Promo GM</span><b>{(econ.promoGM * 100).toFixed(1)}%</b></div>
          <div><span className="eyebrow">Baseline units</span><b>{econ.baseUnits.toLocaleString()}</b></div><div><span className="eyebrow">Forecast units</span><b>{econ.planUnits.toLocaleString()}</b></div><div><span className="eyebrow">Vendor funding</span><b>${Math.round(econ.totalFunds).toLocaleString()}</b></div>
        </div><p className="hint" style={{ marginBottom: 0 }}>Save as a draft to see every approval rule. Nothing is sent to the retailer until you submit.</p></div></section>}

      {state?.error && <p className="flash err" role="alert">{state.error}</p>}
      <div className="actions"><button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Save draft and review'}</button></div>
    </form>
  );
}
