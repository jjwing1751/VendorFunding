'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BANNERS = ['COB', 'MPF', 'CW', 'TAD', 'HORN'] as const
const FUNDING_TYPES = ['OI', 'BB', 'LS', 'PA', 'SBP', 'AMAP', 'TPR', 'AWG'] as const

export default function RegisterDealPage() {
  const router = useRouter()
  const [banners, setBanners] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const toggleBanner = (b: string) =>
    setBanners((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, status: 'DRAFT' | 'PENDING_APPROVAL') => {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      vendorId: fd.get('vendorId') as string || 'placeholder',
      fundingType: fd.get('fundingType') as string,
      startDate: fd.get('startDate') as string,
      endDate: fd.get('endDate') as string,
      banners,
      ps3Retail: fd.get('ps3Retail') ? Number(fd.get('ps3Retail')) : undefined,
      ps4Retail: fd.get('ps4Retail') ? Number(fd.get('ps4Retail')) : undefined,
      ps5Retail: fd.get('ps5Retail') ? Number(fd.get('ps5Retail')) : undefined,
      regularCaseCost: fd.get('regularCaseCost') ? Number(fd.get('regularCaseCost')) : undefined,
      dealCaseCost: fd.get('dealCaseCost') ? Number(fd.get('dealCaseCost')) : undefined,
      totalFunding: fd.get('totalFunding') ? Number(fd.get('totalFunding')) : undefined,
      aimContractNum: fd.get('aimContractNum') as string,
      notes: fd.get('notes') as string,
      status,
    }
    try {
      const res = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) router.push('/deals')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <form onSubmit={(e) => handleSubmit(e, 'PENDING_APPROVAL')}>
        {/* Vendor & Deal Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Vendor &amp; Deal Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label>Vendor Name</label>
              <input name="vendorId" className="form-control" placeholder="Type vendor name…" required style={{ marginTop: 4 }} />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Vendor lookup coming soon</div>
            </div>
            <div>
              <label>Funding Type</label>
              <select name="fundingType" className="form-control" required style={{ marginTop: 4 }}>
                <option value="">Select type…</option>
                {FUNDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Start Date</label>
              <input name="startDate" type="date" className="form-control" required style={{ marginTop: 4 }} />
            </div>
            <div>
              <label>End Date</label>
              <input name="endDate" type="date" className="form-control" required style={{ marginTop: 4 }} />
            </div>
            <div>
              <label>AIM Contract # <span style={{ color: 'var(--text-3)' }}>(TPR only)</span></label>
              <input name="aimContractNum" className="form-control" placeholder="e.g. AIM-2024-001" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label>Total Funding ($)</label>
              <input name="totalFunding" type="number" step="0.01" className="form-control" placeholder="0.00" style={{ marginTop: 4 }} />
            </div>
          </div>
        </div>

        {/* Banners */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Store Banners</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {BANNERS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => toggleBanner(b)}
                className="btn"
                style={{
                  background: banners.includes(b) ? 'var(--cobalt-mid)' : 'transparent',
                  color: banners.includes(b) ? '#fff' : 'var(--text-2)',
                  border: `1px solid ${banners.includes(b) ? 'var(--cobalt-mid)' : 'var(--border)'}`,
                }}
              >
                {b}
              </button>
            ))}
          </div>
          {banners.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Select at least one banner</div>
          )}
        </div>

        {/* Price Strategy */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Price Strategy</div>
            <span className="badge badge-blue" style={{ fontSize: 10.5 }}>Source of record → FMS 400</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label>PS-3 Rural</label>
              <input name="ps3Retail" type="number" step="0.01" className="form-control" placeholder="$0.00" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label>PS-4 Mid-Comp</label>
              <input name="ps4Retail" type="number" step="0.01" className="form-control" placeholder="$0.00" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label>PS-5 Most-Comp</label>
              <input name="ps5Retail" type="number" step="0.01" className="form-control" placeholder="$0.00" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label>Regular Case Cost</label>
              <input name="regularCaseCost" type="number" step="0.01" className="form-control" placeholder="$0.00" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label>Deal Case Cost</label>
              <input name="dealCaseCost" type="number" step="0.01" className="form-control" placeholder="$0.00" style={{ marginTop: 4 }} />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 600 }}>Notes</label>
          <textarea name="notes" className="form-control" rows={3} placeholder="Additional deal notes…" style={{ marginTop: 8 }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit for Approval'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={(e) => {
              const form = (e.currentTarget as HTMLButtonElement).closest('form') as HTMLFormElement
              handleSubmit({ currentTarget: form, preventDefault: () => {} } as React.FormEvent<HTMLFormElement>, 'DRAFT')
            }}
          >
            Save as Draft
          </button>
        </div>
      </form>
    </div>
  )
}
