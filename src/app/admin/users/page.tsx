'use client'

import { useState, useEffect, useCallback } from 'react'

type User = {
  id: string
  name: string | null
  email: string
  role: string
  active: boolean
  vendorId: string | null
  categoryIds: string[]
  createdAt: string
  vendor: { name: string } | null
}

const ROLE_OPTIONS = ['VENDOR', 'BROKER', 'BUYER', 'MANAGER', 'ADMIN']
const ROLE_COLORS: Record<string, string> = {
  VENDOR: '#d97706',
  BROKER: '#7c3aed',
  BUYER: '#2563eb',
  MANAGER: '#059669',
  ADMIN: '#002C77',
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/users${q}`)
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  async function patch(id: string, changes: Partial<User>) {
    setSaving(id)
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    setSaving(null)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Users</h2>
        <input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 14,
            width: 240,
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : users.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No users found.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Role</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{u.name || '—'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</div>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      disabled={saving === u.id}
                      onChange={(e) => patch(u.id, { role: e.target.value })}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        fontWeight: 700,
                        color: ROLE_COLORS[u.role] || '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>
                    {u.vendor ? `Vendor: ${u.vendor.name}` : u.categoryIds.length ? `${u.categoryIds.length} categories` : '—'}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: u.active ? '#d1fae5' : '#fee2e2',
                        color: u.active ? '#065f46' : '#991b1b',
                      }}
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      onClick={() => patch(u.id, { active: !u.active })}
                      disabled={saving === u.id}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        color: u.active ? '#dc2626' : '#059669',
                        cursor: 'pointer',
                      }}
                    >
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
