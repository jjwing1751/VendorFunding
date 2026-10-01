'use client'
import { useState } from 'react'

type Stage = 'drop' | 'preview' | 'success'

export default function BulkImportPage() {
  const [stage, setStage] = useState<Stage>('drop')
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload')

  const columnMap = [
    { caissp: 'Vendor Name', vfm: 'Vendor Name' },
    { caissp: 'Account #', vfm: 'Vendor Account #' },
    { caissp: 'UPC', vfm: 'Item UPC' },
    { caissp: 'Item Description', vfm: 'Item Description' },
    { caissp: 'Funding Type', vfm: 'Funding Type (OI/BB/LS…)' },
    { caissp: 'Start Date', vfm: 'Deal Start Date' },
    { caissp: 'End Date', vfm: 'Deal End Date' },
    { caissp: 'Case Allowance', vfm: 'Total Funding ($)' },
    { caissp: 'Retail PS-3', vfm: 'PS-3 Retail (Rural)' },
    { caissp: 'Retail PS-4', vfm: 'PS-4 Retail (Mid-Comp)' },
    { caissp: 'Retail PS-5', vfm: 'PS-5 Retail (Most-Comp)' },
    { caissp: 'Banner(s)', vfm: 'Store Banners (COB/MPF…)' },
  ]

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['upload', 'manual'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--cobalt-mid)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--cobalt-mid)' : 'var(--text-2)',
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontSize: 13.5,
              marginBottom: -1,
            }}
          >
            {tab === 'upload' ? 'Upload CAISSP File' : 'Manual Grid Entry'}
          </button>
        ))}
      </div>

      {activeTab === 'upload' && (
        <>
          {stage === 'drop' && (
            <>
              {/* Drop zone */}
              <div
                className="card"
                style={{
                  border: '2px dashed var(--border)',
                  textAlign: 'center',
                  padding: 48,
                  marginBottom: 20,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => setStage('preview')}
                onClick={() => setStage('preview')}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>⇪</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Drop CAISSP export here</div>
                <div style={{ color: 'var(--text-3)', fontSize: 13 }}>or click to browse · .xlsx, .csv supported</div>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={(e) => { e.stopPropagation(); setStage('preview') }}>
                  Browse File
                </button>
              </div>

              {/* Column mapping reference */}
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>CAISSP → VFM Column Mapping</div>
                <table className="data-table">
                  <thead>
                    <tr><th>CAISSP Column</th><th>VFM Field</th></tr>
                  </thead>
                  <tbody>
                    {columnMap.map((r) => (
                      <tr key={r.caissp}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{r.caissp}</td>
                        <td>{r.vfm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {stage === 'preview' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Preview (3 rows)</div>
                <span className="badge badge-green">3 valid</span>
                <span className="badge badge-amber">1 warning</span>
              </div>
              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr><th>#</th><th>Vendor</th><th>UPC</th><th>Type</th><th>Start</th><th>End</th><th>Funding</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {[
                    { v: 'General Mills', u: '016000275270', t: 'OI', s: '2026-10-01', e: '2026-12-31', f: '$0.45/cs', ok: true },
                    { v: 'Kellogg\'s', u: '038000845123', t: 'TPR', s: '2026-10-15', e: '2026-11-15', f: '$0.30/cs', ok: false },
                    { v: 'Unilever', u: '012345678901', t: 'BB', s: '2026-10-01', e: '2026-10-31', f: '$1,200 LS', ok: true },
                  ].map((r, i) => (
                    <tr key={i} style={{ background: r.ok ? undefined : '#fffbeb' }}>
                      <td>{i + 1}</td>
                      <td>{r.v}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.u}</td>
                      <td><span className="badge badge-blue">{r.t}</span></td>
                      <td>{r.s}</td>
                      <td>{r.e}</td>
                      <td>{r.f}</td>
                      <td>{r.ok ? <span className="badge badge-green">OK</span> : <span className="badge badge-amber">Missing AIM #</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={() => setStage('success')}>Confirm Import (3 deals)</button>
                <button className="btn btn-secondary" onClick={() => setStage('drop')}>← Back</button>
              </div>
            </div>
          )}

          {stage === 'success' && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: 'var(--green)' }}>Import Complete</div>
              <div style={{ color: 'var(--text-2)', marginBottom: 20 }}>3 deals created and queued for approval</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <a href="/deals" className="btn btn-primary">View Deals</a>
                <button className="btn btn-secondary" onClick={() => setStage('drop')}>Import Another</button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'manual' && (
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Manual Grid Entry</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>UPC</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>PS-3</th>
                <th>PS-4</th>
                <th>PS-5</th>
                <th>Funding</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td><input className="form-control" style={{ padding: '5px 8px', fontSize: 12.5 }} placeholder="Vendor…" /></td>
                  <td><input className="form-control" style={{ padding: '5px 8px', fontSize: 12.5, width: 130 }} placeholder="UPC" /></td>
                  <td>
                    <select className="form-control" style={{ padding: '5px 8px', fontSize: 12.5 }}>
                      <option value="">Type</option>
                      {['OI','BB','LS','PA','SBP','AMAP','TPR','AWG'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td><input type="date" className="form-control" style={{ padding: '5px 8px', fontSize: 12.5 }} /></td>
                  <td><input type="date" className="form-control" style={{ padding: '5px 8px', fontSize: 12.5 }} /></td>
                  <td><input type="number" step="0.01" className="form-control" style={{ padding: '5px 8px', fontSize: 12.5, width: 80 }} placeholder="$0.00" /></td>
                  <td><input type="number" step="0.01" className="form-control" style={{ padding: '5px 8px', fontSize: 12.5, width: 80 }} placeholder="$0.00" /></td>
                  <td><input type="number" step="0.01" className="form-control" style={{ padding: '5px 8px', fontSize: 12.5, width: 80 }} placeholder="$0.00" /></td>
                  <td><input type="number" step="0.01" className="form-control" style={{ padding: '5px 8px', fontSize: 12.5, width: 90 }} placeholder="$0.00" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm">+ Add Row</button>
            <button className="btn btn-primary btn-sm">Submit All for Approval</button>
          </div>
        </div>
      )}
    </div>
  )
}
