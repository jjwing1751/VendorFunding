import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'

type SessionUser = { id: string; email: string; role: string; vendorId?: string }

// In Next.js 14, params are synchronous
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
      include: {
        vendor: true,
        items: { include: { item: true } },
        fundingLines: true,
        approvals: { orderBy: { step: 'asc' } },
      },
    })
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Vendors can only see their own deals
    if (user.role === 'VENDOR' && deal.vendorId !== user.vendorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(deal)
  } catch (err) {
    console.error('[GET /api/deals/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const before = await prisma.deal.findUnique({
      where: { id: params.id },
      select: { status: true, vendorId: true, fundingType: true, startDate: true, endDate: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Vendors can only edit their own deals
    if (user.role === 'VENDOR' && before.vendorId !== user.vendorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: { ...body, updatedAt: new Date() },
    })

    await audit({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'Deal',
      entityId: deal.id,
      before,
      after: { status: deal.status },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(deal)
  } catch (err) {
    console.error('[PATCH /api/deals/[id]]', err)
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
  }
}

// Approve or reject a deal step
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only BUYER, MANAGER, ADMIN can approve/reject
    if (!['BUYER', 'MANAGER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, step, notes } = await request.json()

    await prisma.approval.updateMany({
      where: { dealId: params.id, step },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        approverId: user.id,
        notes,
        decidedAt: new Date(),
      },
    })

    const allApprovals = await prisma.approval.findMany({ where: { dealId: params.id } })
    const allApproved = allApprovals.every((a: { status: string }) => a.status === 'APPROVED')

    let deal
    if (allApproved) {
      deal = await prisma.deal.update({
        where: { id: params.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      })
    } else if (action === 'reject') {
      deal = await prisma.deal.update({
        where: { id: params.id },
        data: { status: 'REJECTED' },
      })
    }

    await audit({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'Deal',
      entityId: params.id,
      after: { action, step, status: deal?.status },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ deal })
  } catch (err) {
    console.error('[POST /api/deals/[id]]', err)
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 })
  }
}
