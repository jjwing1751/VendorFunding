'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

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
}

export default function TopBar() {
  const pathname = usePathname()
  const title = titles[pathname] ?? 'VFM'

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
    </div>
  )
}
