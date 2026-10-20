import { saveEvent } from './actions';
type E = { id?: string; name?: string; theme?: string | null; startDate?: string; endDate?: string; vehicles?: string[]; mediaBudget?: number; fundingTarget?: number };
export function EventForm({ e = {} }: { e?: E }) {
  return (
    <form action={saveEvent} className="form">
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <div className="fgrid">
        <div className="field"><label htmlFor="name">Event name</label><input id="name" name="name" defaultValue={e.name} required maxLength={80} /></div>
        <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="theme">Ad theme</label><input id="theme" name="theme" defaultValue={e.theme ?? ''} maxLength={200} /></div>
        <div className="field"><label htmlFor="startDate">Start</label><input id="startDate" name="startDate" type="date" defaultValue={e.startDate} required /></div>
        <div className="field"><label htmlFor="endDate">End</label><input id="endDate" name="endDate" type="date" defaultValue={e.endDate} required /></div>
        <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="vehicles">Vehicles (comma-separated)</label><input id="vehicles" name="vehicles" defaultValue={(e.vehicles ?? ['Circular p1', 'Endcaps', 'Retail media']).join(', ')} /></div>
        <div className="field"><label htmlFor="mediaBudget">Media spend ($)</label><input id="mediaBudget" name="mediaBudget" inputMode="decimal" defaultValue={e.mediaBudget ?? 0} /></div>
        <div className="field"><label htmlFor="fundingTarget">Vendor funding target ($)</label><input id="fundingTarget" name="fundingTarget" inputMode="decimal" defaultValue={e.fundingTarget ?? 0} /></div>
      </div>
      <div><button className="btn primary">Save event</button></div>
    </form>
  );
}
