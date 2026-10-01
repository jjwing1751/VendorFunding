'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/deals': 'Deals',
  '/deals/new': 'Register Deal',
  '/calendar': 'Promo Calendar',
  '/bulk-import': 'Bulk Import',
  '/approvals': 'Approval Queue',
  '/ai-recs': 'AI Recommendations',
  '/vendors': 'Vendors',
  '/items': 'Items / UPCs',
  '/admin/users': 'User Management',
  '/admin/invitations': 'Invitations',
  '/admin/audit-log': 'Audit Log',
}

const ROLE_LABELS: Record<string, string> = {
  VENDOR: 'Vendor',
  BROKER: 'Broker',
  BUYER: 'Buyer',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
}

export default function TopBar({ session }: { session: Session | null }) {
  const pathname = usePathname()
  const title = titles[pathname] ?? 'VFM'
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined

  return (
    <div className="top-bar">
      <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{title}</h1>

      <span className="badge badge-proto">PROTOTYPE</span>

      {(pathname === '/' || pathname === '/deals') && (
        <Link href="/deals/new" className="btn btn-primary btn-sm">
          + Register Deal
        </Link>
      )}
      {pathname === '/deals' && (
        <Link href="/bulk-import" className="btn btn-secondary btn-sm">
          Bulk Import
        </Link>
      )}

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          {/* User chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: 'var(--surface-2, #f3f4f6)',
              borderRadius: 20,
              fontSize: 13,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--cobalt, #002C77)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {(user.name || user.email || '?').charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              {user.name || user.email}
            </span>
            {user.role && (
              <span
                style={{
                  background: 'var(--cobalt, #002C77)',
                  color: '#fff',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            )}
          </div>

          {/* Sign-out button */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              background: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
