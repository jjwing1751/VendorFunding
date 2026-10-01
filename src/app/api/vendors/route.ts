import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'

type SessionUser = { id: string; email: string; role: string; vendorId?: string }

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    // Vendors can only see their own vendor record
    const where =
      user.role === 'VENDOR'
        ? { id: user.vendorId ?? '__none__' }
        : q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { accountNum: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : undefined

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 100,
    })

    return NextResponse.json(vendors)
  } catch (err) {
    console.error('[GET /api/vendors]', err)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only ADMIN and MANAGER can create vendors
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const vendor = await prisma.vendor.create({ data: body })

    await audit({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'Vendor',
      entityId: vendor.id,
      after: { name: vendor.name, accountNum: vendor.accountNum },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch (err) {
    console.error('[POST /api/vendors]', err)
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 })
  }
}
