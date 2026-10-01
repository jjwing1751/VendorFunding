import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// In Next.js 14, params are synchronous
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    return NextResponse.json(deal)
  } catch (err) {
    console.error('[GET /api/deals/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: { ...body, updatedAt: new Date() },
    })
    return NextResponse.json(deal)
  } catch (err) {
    console.error('[PATCH /api/deals/[id]]', err)
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
  }
}

// Approve or reject a deal step
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action, step, notes } = await request.json()

    await prisma.approval.updateMany({
      where: { dealId: params.id, step },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
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

    return NextResponse.json({ deal })
  } catch (err) {
    console.error('[POST /api/deals/[id]]', err)
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 })
  }
}
