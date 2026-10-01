import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    const vendors = await prisma.vendor.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { accountNum: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
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
    const body = await request.json()
    const vendor = await prisma.vendor.create({ data: body })
    return NextResponse.json(vendor, { status: 201 })
  } catch (err) {
    console.error('[POST /api/vendors]', err)
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 })
  }
}
