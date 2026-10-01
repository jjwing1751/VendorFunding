import type { Metadata } from 'next'
import './globals.css'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AuthProvider from '@/components/AuthProvider'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'VFM · Vendor Funding Management',
  description: 'Coborns Vendor Funding Management System',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <body>
        <AuthProvider session={session}>
          <AppShell session={session}>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
