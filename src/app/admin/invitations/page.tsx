'use client'

import { useState, useEffect, useCallback } from 'react'

type Invitation = {
  id: string
  email: string
  role: string
  acceptedAt: string | null
  expiresAt: string
  createdAt: string
  token: string
  invitedBy: { name: string | null; email: string } | null
}

const ROLE_OPTIONS = ['VENDOR', 'BROKER', 'BUYER', 'MANAGER', 'ADMIN']

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  // New invite form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('BUYER')
  const [sending, setSending] = useState(false)
  const [sentUrl, setSentUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/invitations')
    const data = await res.json()
    setInvitations(data.invitations || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setFormError(null)
    setSentUrl(null)
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    if (!res.ok) {
      setFormError(data.error || 'Failed to send invitation.')
    } else {
      setSentUrl(data.inviteUrl)
      setEmail('')
      setRole('BUYER')
      load()
    }
    setSending(false)
  }

  function status(inv: Invitation) {
    if (inv.acceptedAt) return { label: 'Accepted', color: '#065f46', bg: '#d1fae5' }
    if (new Date(inv.expiresAt) < new Date()) return { label: 'Expired', color: '#991b1b', bg: '#fee2e2' }
    return { label: 'Pending', color: '#92400e', bg: '#fef3c7' }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Invitations</h2>

      {/* Send invite form */}
      <div className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
          Send new invitation
        </h3>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: '0 0 160px' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="btn btn-primary"
            style={{ height: 40 }}
          >
            {sending ? 'Sending…' : 'Send invite'}
          </button>
        </form>

        {formError && (
          <div style={{ marginTop: 12, color: '#dc2626', fontSize: 14 }}>{formError}</div>
        )}

        {sentUrl && (
          <div
            style={{
              marginTop: 12,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 13,
            }}
          >
            <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#065f46' }}>
              Invitation created! Share this link with the invitee:
            </p>
            <code
              style={{
                display: 'block',
                background: '#dcfce7',
                padding: '6px 10px',
                borderRadius: 4,
                wordBreak: 'break-all',
                color: '#14532d',
                fontSize: 12,
              }}
            >
              {sentUrl}
            </code>
          </div>
        )}
      </div>

      {/* Invitation list */}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : invitations.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No invitations yet.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Invited by</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const s = status(inv)
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.email}</td>
                    <td>{inv.role}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 9999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: s.bg,
                          color: s.color,
                        }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>
                      {inv.invitedBy?.name || inv.invitedBy?.email || '—'}
                    </td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
