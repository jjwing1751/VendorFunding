import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id: string; role: string } | undefined
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const entity = searchParams.get('entity') || undefined
  const action = searchParams.get('action') || undefined
  const search = searchParams.get('search') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = 50

  const where = {
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
    ...(search
      ? {
          OR: [
            { userEmail: { contains: search, mode: 'insensitive' as const } },
            { entityId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, pageSize })
}
