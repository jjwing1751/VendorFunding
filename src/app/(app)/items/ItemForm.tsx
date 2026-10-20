import { saveItem } from './actions';
type I = { upc: string; description: string; size: string | null; uom: string | null; orderCode: string | null; casePack: number; caseCost: number; regularRetail: number; baseWeeklyUnits: number; vendorId: string | null };
export function ItemForm({ item, vendors }: { item?: I; vendors: { id: string; name: string }[] }) {
  return (
    <form action={saveItem} className="form">
      {item && <input type="hidden" name="existing" value={item.upc} />}
      <div className="fgrid">
        <div className="field"><label htmlFor="upc">UPC</label><input id="upc" name="upc" defaultValue={item?.upc} readOnly={!!item} required placeholder="0-12345-67890" /></div>
        <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="description">Description</label><input id="description" name="description" defaultValue={item?.description} required maxLength={120} /></div>
        <div className="field"><label htmlFor="vendorId">Brand owner</label><select id="vendorId" name="vendorId" defaultValue={item?.vendorId ?? ''}><option value="">Own brand / fresh</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div className="field"><label htmlFor="size">Size</label><input id="size" name="size" defaultValue={item?.size ?? ''} /></div>
        <div className="field"><label htmlFor="uom">UOM</label><input id="uom" name="uom" defaultValue={item?.uom ?? ''} /></div>
        <div className="field"><label htmlFor="orderCode">Order code</label><input id="orderCode" name="orderCode" defaultValue={item?.orderCode ?? ''} /></div>
        <div className="field"><label htmlFor="casePack">Case pack</label><input id="casePack" name="casePack" inputMode="numeric" defaultValue={item?.casePack ?? 12} required /></div>
        <div className="field"><label htmlFor="caseCost">Case cost ($)</label><input id="caseCost" name="caseCost" inputMode="decimal" defaultValue={item?.caseCost} required /></div>
        <div className="field"><label htmlFor="regularRetail">Regular retail ($)</label><input id="regularRetail" name="regularRetail" inputMode="decimal" defaultValue={item?.regularRetail} required /></div>
        <div className="field"><label htmlFor="baseWeeklyUnits">Baseline weekly units</label><input id="baseWeeklyUnits" name="baseWeeklyUnits" inputMode="numeric" defaultValue={item?.baseWeeklyUnits ?? 100} required /></div>
      </div>
      <div><button className="btn primary">{item ? 'Save item' : 'Add item'}</button></div>
    </form>
  );
}
