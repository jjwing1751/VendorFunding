export default function CalendarPage() {
  const weeks = ['Oct W1', 'Oct W2', 'Oct W3', 'Oct W4', 'Nov W1', 'Nov W2', 'Nov W3', 'Nov W4', 'Dec W1', 'Dec W2', 'Dec W3', 'Dec W4']

  const demoDeals = [
    { vendor: 'General Mills', type: 'OI', start: 0, end: 7, color: '#dbeafe', text: '#1d4ed8' },
    { vendor: 'Kellogg\'s', type: 'TPR', start: 2, end: 5, color: '#fef3c7', text: '#d97706' },
    { vendor: 'Unilever', type: 'BB', start: 4, end: 11, color: '#dcfce7', text: '#16a34a' },
    { vendor: 'ConAgra', type: 'LS', start: 1, end: 3, color: '#f3e8ff', text: '#7c3aed' },
    { vendor: 'PepsiCo', type: 'AMAP', start: 6, end: 11, color: '#fee2e2', text: '#dc2626' },
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
          Promo Calendar — Q4 2026
          <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>
            Showing demo data
          </span>
        </div>

        {/* Week headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `140px repeat(${weeks.length}, 1fr)`,
          gap: 0,
          marginBottom: 8,
        }}>
          <div />
          {weeks.map((w) => (
            <div key={w} style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-3)',
              textAlign: 'center',
              padding: '0 2px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {w}
            </div>
          ))}
        </div>

        {/* Gantt rows */}
        {demoDeals.map((d) => (
          <div key={d.vendor} style={{
            display: 'grid',
            gridTemplateColumns: `140px repeat(${weeks.length}, 1fr)`,
            gap: 0,
            marginBottom: 8,
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 12.5, color: 'var(--text)', paddingRight: 8 }}>
              <div style={{ fontWeight: 500 }}>{d.vendor}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 11 }}>{d.type}</div>
            </div>
            {weeks.map((_, i) => (
              <div key={i} style={{ position: 'relative', height: 28, padding: '0 1px' }}>
                {i >= d.start && i <= d.end && (
                  <div style={{
                    position: 'absolute',
                    inset: '2px 0',
                    background: d.color,
                    borderRadius: i === d.start ? '6px 0 0 6px' : i === d.end ? '0 6px 6px 0' : 0,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: i === d.start ? 8 : 0,
                    overflow: 'hidden',
                  }}>
                    {i === d.start && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: d.text, whiteSpace: 'nowrap' }}>
                        {d.vendor}
                      </span>
                    )}
                  </div>
                )}
                {(i < d.start || i > d.end) && (
                  <div style={{ height: '100%', background: 'var(--surface-3)', borderRadius: 2 }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
