import Link from 'next/link'

const statusColors: Record<string, string> = {
  DRAFT: 'badge-gray',
  PENDING_APPROVAL: 'badge-amber',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
  ACTIVE: 'badge-blue',
  EXPIRED: 'badge-gray',
  CANCELLED: 'badge-gray',
}

export default function DealsPage() {
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Filter bar */}
      <div className="filter-bar">
        <input className="form-control" placeholder="Search deals…" style={{ width: 240 }} />
        <select className="form-control">
          <option value="">All Statuses</option>
          <option>DRAFT</option>
          <option>PENDING_APPROVAL</option>
          <option>APPROVED</option>
          <option>ACTIVE</option>
          <option>REJECTED</option>
        </select>
        <select className="form-control">
          <option value="">All Types</option>
          {['OI','BB','LS','PA','SBP','AMAP','TPR','AWG'].map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="form-control">
          <option value="">All Banners</option>
          {['COB','MPF','CW','TAD','HORN'].map(b => <option key={b}>{b}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link href="/bulk-import" className="btn btn-secondary btn-sm">Bulk Import</Link>
          <Link href="/deals/new" className="btn btn-primary btn-sm">+ Register Deal</Link>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Deal #</th>
              <th>Vendor</th>
              <th>Type</th>
              <th>Banners</th>
              <th>PS-3</th>
              <th>PS-4</th>
              <th>PS-5</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th>Funding</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                No deals found — <Link href="/deals/new" style={{ color: 'var(--cobalt-lt)' }}>register a deal</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend for status colors */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(statusColors).map(([s, cls]) => (
          <span key={s} className={`badge ${cls}`}>{s}</span>
        ))}
      </div>
    </div>
  )
}
