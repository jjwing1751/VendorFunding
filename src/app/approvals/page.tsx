export default function ApprovalsPage() {
  const steps = [
    { step: 1, role: 'Buyer', desc: 'Initial deal review' },
    { step: 2, role: 'Category Mgr', desc: 'Category sign-off' },
    { step: 3, role: 'Finance', desc: 'Funding verification' },
    { step: 4, role: 'FMS 400 Push', desc: 'Price push to FMS 400' },
  ]

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Workflow legend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Approval Workflow</div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {steps.map((s, i) => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--cobalt-mid)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, margin: '0 auto 6px',
                }}>
                  {s.step}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.role}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.desc}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1, height: 2, background: 'var(--border)',
                  margin: '-18px 12px 0', minWidth: 40,
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending approvals table */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Pending Approvals</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Deal #</th>
              <th>Vendor</th>
              <th>Type</th>
              <th>Step</th>
              <th>Submitted</th>
              <th>Funding</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                No deals pending approval
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
