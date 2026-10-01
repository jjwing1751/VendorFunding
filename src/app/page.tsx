import Link from 'next/link'

const stats = [
  { label: 'Active Deals', value: '—', sub: 'Loading from DB' },
  { label: 'Pending Approval', value: '—', sub: 'Awaiting review' },
  { label: 'Total Funding YTD', value: '—', sub: 'Across all types' },
  { label: 'FMS 400 Synced', value: '—', sub: 'Last sync: —' },
]

export default function Dashboard() {
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-tile">
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
            <div className="sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/deals/new" className="btn btn-primary">+ Register Deal</Link>
          <Link href="/bulk-import" className="btn btn-secondary">Bulk Import (CAISSP)</Link>
          <Link href="/approvals" className="btn btn-secondary">Approval Queue</Link>
          <Link href="/ai-recs" className="btn btn-secondary">AI Recommendations</Link>
        </div>
      </div>

      {/* FMS 400 sync status */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--green)'
          }} />
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>FMS 400 Connection</span>
          <span className="badge badge-green">Connected</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
            Prices push to FMS 400 automatically on deal approval
          </span>
        </div>
      </div>

      {/* Recent deals placeholder */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Recent Deals</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Deal #</th>
              <th>Vendor</th>
              <th>Type</th>
              <th>Banners</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th>Funding</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                No deals yet — <Link href="/deals/new" style={{ color: 'var(--cobalt-lt)' }}>register your first deal</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
