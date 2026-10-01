'use client'

import { useState, useEffect, useCallback } from 'react'

type AuditLog = {
  id: string
  userEmail: string | null
  action: string
  entity: string
  entityId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  CREATE: { bg: '#d1fae5', color: '#065f46' },
  UPDATE: { bg: '#dbeafe', color: '#1e40af' },
  DELETE: { bg: '#fee2e2', color: '#991b1b' },
  LOGIN: { bg: '#f3e8ff', color: '#6b21a8' },
  LOGOUT: { bg: '#f3f4f6', color: '#374151' },
  INVITE: { bg: '#fef3c7', color: '#92400e' },
  ACCEPT_INVITE: { bg: '#d1fae5', color: '#065f46' },
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (search) params.set('search', search)
    if (filterAction) params.set('action', filterAction)
    if (filterEntity) params.set('entity', filterEntity)

    const res = await fetch(`/api/audit-log?${params}`)
    const data = await res.json()
    setLogs(data.logs || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [page, search, filterAction, filterEntity])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Audit Log
        <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280', marginLeft: 12 }}>
          {total.toLocaleString()} entries
        </span>
      </h2>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search email or entity ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{
            flex: '1 1 200px',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
        />
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
        >
          <option value="">All actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'INVITE', 'ACCEPT_INVITE'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filterEntity}
          onChange={(e) => { setFilterEntity(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
        >
          <option value="">All entities</option>
          {['Deal', 'Vendor', 'Item', 'User', 'Invitation', 'Approval'].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : logs.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No log entries found.</p>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>IP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ac = ACTION_COLORS[log.action] || { bg: '#f3f4f6', color: '#374151' }
                  const isExpanded = expanded === log.id
                  return (
                    <>
                      <tr key={log.id}>
                        <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td style={{ fontSize: 13 }}>{log.userEmail || '—'}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: ac.bg,
                              color: ac.color,
                              letterSpacing: '0.03em',
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{log.entity}</td>
                        <td style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                          {log.entityId ? log.entityId.slice(-8) : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: '#6b7280' }}>{log.ip || '—'}</td>
                        <td>
                          {(log.before || log.after) && (
                            <button
                              onClick={() => setExpanded(isExpanded ? null : log.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#2563eb',
                                fontSize: 12,
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              {isExpanded ? 'Hide' : 'Details'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (log.before || log.after) && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={7} style={{ background: '#f9fafb', padding: '12px 20px' }}>
                            <div style={{ display: 'flex', gap: 24 }}>
                              {log.before && (
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Before</p>
                                  <pre style={{ margin: 0, fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(log.before, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.after && (
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#374151' }}>After</p>
                                  <pre style={{ margin: 0, fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(log.after, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: '#374151' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
