'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

type InviteInfo = {
  email: string
  role: string
}

export default function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('No invitation token found.')
      setLoading(false)
      return
    }
    fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setInvite(data)
      })
      .catch(() => setError('Failed to validate invitation.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setSubmitting(true)

    const res = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to accept invitation.')
      setSubmitting(false)
      return
    }

    // Auto sign-in after account creation
    await signIn('credentials', {
      email: invite?.email,
      password,
      callbackUrl: '/',
    })
  }

  const ROLE_LABELS: Record<string, string> = {
    VENDOR: 'Vendor',
    BROKER: 'Broker',
    BUYER: 'Buyer',
    MANAGER: 'Manager',
    ADMIN: 'Admin',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          padding: '48px 40px 40px',
          width: '100%',
          maxWidth: 420,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#002C77',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 22,
              margin: '0 auto 12px',
            }}
          >
            V
          </div>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Vendor Funding Management</p>
        </div>

        {loading && (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Validating invitation…</p>
        )}

        {!loading && error && !invite && (
          <>
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '12px 16px',
                color: '#dc2626',
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              {error}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
              Contact your administrator for a new invitation link.
            </p>
          </>
        )}

        {!loading && invite && (
          <>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 8px',
                textAlign: 'center',
              }}
            >
              Set up your account
            </h1>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
              You&apos;ve been invited as a{' '}
              <strong>{ROLE_LABELS[invite.role] ?? invite.role}</strong> for{' '}
              <strong>{invite.email}</strong>.
            </p>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#dc2626',
                  fontSize: 14,
                  marginBottom: 20,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="name"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
                >
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="password"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label
                  htmlFor="confirm"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: submitting ? '#93c5fd' : '#002C77',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Creating account…' : 'Create account & sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
