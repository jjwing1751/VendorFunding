'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const nav = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: '◈' },
      { label: 'Deals', href: '/deals', icon: '◇' },
      { label: 'Promo Calendar', href: '/calendar', icon: '◻' },
    ],
  },
  {
    section: 'Register',
    items: [
      { label: 'Register Deal', href: '/deals/new', icon: '+' },
      { label: 'Bulk Import', href: '/bulk-import', icon: '⇪' },
    ],
    roles: ['BUYER', 'MANAGER', 'ADMIN'],
  },
  {
    section: 'Workflow',
    items: [
      { label: 'Approval Queue', href: '/approvals', icon: '✓' },
      { label: 'AI Recommendations', href: '/ai-recs', icon: '✦' },
    ],
    roles: ['BUYER', 'MANAGER', 'ADMIN'],
  },
  {
    section: 'Data',
    items: [
      { label: 'Vendors', href: '/vendors', icon: '◉' },
      { label: 'Items / UPCs', href: '/items', icon: '▤' },
    ],
    roles: ['BUYER', 'MANAGER', 'ADMIN'],
  },
  {
    section: 'Admin',
    items: [
      { label: 'Users', href: '/admin/users', icon: '👤' },
      { label: 'Invitations', href: '/admin/invitations', icon: '✉' },
      { label: 'Audit Log', href: '/admin/audit-log', icon: '📋' },
    ],
    roles: ['ADMIN'],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role || ''

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">VFM · Coborns</div>
      {nav.map((group) => {
        // Hide group if role restriction applies and user doesn't qualify
        if (group.roles && !group.roles.includes(role)) return null
        return (
          <div key={group.section}>
            <div className="sidebar-section">{group.section}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${pathname === item.href ? ' active' : ''}`}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        )
      })}
      <div style={{ marginTop: 'auto', padding: '16px', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
        v0.1 · Prototype
      </div>
    </nav>
  )
}
