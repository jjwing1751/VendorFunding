const recs = [
  {
    type: 'Timing',
    title: 'General Mills OI deal gap in Nov W2',
    body: 'No OI deal with General Mills covers the week of Nov 10–16. Historical data shows competitor pricing drops during this window. Consider registering a TPR deal to protect share.',
    confidence: 87,
    badgeClass: 'badge-blue',
    cta: 'Register Deal',
  },
  {
    type: 'Price',
    title: 'PS-5 price on Kellogg\'s may be too high',
    body: 'The PS-5 retail on deal #KLG-2026-44 is $4.49, while competitive set average is $3.99. A $0.25 reduction would bring it in line with most-comp markets.',
    confidence: 73,
    badgeClass: 'badge-amber',
    cta: 'View Deal',
  },
  {
    type: 'Funding',
    title: 'Unilever BB rate under industry average',
    body: 'Bill-back rate on active Unilever deals averages 3.2%. Category peers average 4.8%. Opportunity to renegotiate before Q1 planning cycle.',
    confidence: 65,
    badgeClass: 'badge-purple',
    cta: 'Review Deals',
  },
]

export default function AiRecsPage() {
  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--surface-3)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-2)' }}>
        ✦ AI recommendations are generated from deal history and pricing patterns. Always verify before acting.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {recs.map((r) => (
          <div key={r.title} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <span className={`badge ${r.badgeClass}`}>{r.type}</span>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Confidence</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: r.confidence >= 80 ? 'var(--green)' : r.confidence >= 65 ? 'var(--amber)' : 'var(--text-3)' }}>
                  {r.confidence}%
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>{r.body}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm">{r.cta}</button>
              <button className="btn btn-secondary btn-sm">Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
