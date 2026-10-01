import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const CreateDealSchema = z.object({
  vendorId: z.string(),
  fundingType: z.enum(['OI', 'BB', 'LS', 'PA', 'SBP', 'AMAP', 'TPR', 'AWG']),
  startDate: z.string(),
  endDate: z.string(),
  banners: z.array(z.enum(['COB', 'MPF', 'CW', 'TAD', 'HORN'])).default([]),
  ps3Retail: z.number().optional(),
  ps4Retail: z.number().optional(),
  ps5Retail: z.number().optional(),
  regularCaseCost: z.number().optional(),
  dealCaseCost: z.number().optional(),
  totalFunding: z.number().optional(),
  aimContractNum: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL']).default('DRAFT'),
})

type SessionUser = { id: string; email: string; role: string; vendorId?: string; categoryIds?: string[] }

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const vendorId = searchParams.get('vendorId')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    // Role-based data scoping
    if (user.role === 'VENDOR') {
      // Vendors only see their own vendor's deals
      where.vendorId = user.vendorId
    } else if (vendorId) {
      where.vendorId = vendorId
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ])

    return NextResponse.json({ deals, total, page, limit })
  } catch (err) {
    console.error('[GET /api/deals]', err)
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const data = CreateDealSchema.parse(body)

    // Vendors can only submit deals for their own vendor
    if (user.role === 'VENDOR' && user.vendorId && data.vendorId !== user.vendorId) {
      return NextResponse.json({ error: 'Forbidden: can only create deals for your own vendor.' }, { status: 403 })
    }

    const deal = await prisma.deal.create({
      data: {
        vendorId: data.vendorId,
        fundingType: data.fundingType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        banners: data.banners,
        ps3Retail: data.ps3Retail,
        ps4Retail: data.ps4Retail,
        ps5Retail: data.ps5Retail,
        regularCaseCost: data.regularCaseCost,
        dealCaseCost: data.dealCaseCost,
        totalFunding: data.totalFunding,
        aimContractNum: data.aimContractNum,
        notes: data.notes,
        status: data.status,
        createdById: user.id,
        submittedAt: data.status === 'PENDING_APPROVAL' ? new Date() : undefined,
        approvals:
          data.status === 'PENDING_APPROVAL'
            ? {
                create: [
                  { step: 1, approverRole: 'BUYER' },
                  { step: 2, approverRole: 'MANAGER' },
                  { step: 3, approverRole: 'ADMIN' },
                ],
              }
            : undefined,
      },
      include: { vendor: true },
    })

    await audit({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'Deal',
      entityId: deal.id,
      after: { dealNumber: deal.dealNumber, vendorId: deal.vendorId, status: deal.status },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(deal, { status: 201 })
  } catch (err) {
    console.error('[POST /api/deals]', err)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}
