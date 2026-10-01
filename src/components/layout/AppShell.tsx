'use client'

import { usePathname } from 'next/navigation'
import type { Session } from 'next-auth'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

// Pages that render without the shell chrome
const BARE_PAGES = ['/login', '/accept-invite']

export default function AppShell({
  session,
  children,
}: {
  session: Session | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isBare = BARE_PAGES.some((p) => pathname.startsWith(p))

  if (isBare) {
    return <>{children}</>
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <TopBar session={session} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
