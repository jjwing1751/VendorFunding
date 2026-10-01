'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  },
  {
    section: 'Workflow',
    items: [
      { label: 'Approval Queue', href: '/approvals', icon: '✓' },
      { label: 'AI Recommendations', href: '/ai-recs', icon: '✦' },
    ],
  },
  {
    section: 'Data',
    items: [
      { label: 'Vendors', href: '/vendors', icon: '◉' },
      { label: 'Items / UPCs', href: '/items', icon: '▤' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">VFM · Coborns</div>
      {nav.map((group) => (
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
      ))}
      <div style={{ marginTop: 'auto', padding: '16px', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
        v0.1 · Prototype
      </div>
    </nav>
  )
}
