import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    const items = await prisma.item.findMany({
      where: q
        ? {
            OR: [
              { upc: { contains: q } },
              { description: { contains: q, mode: 'insensitive' } },
              { brand: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { description: 'asc' },
      take: 100,
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error('[GET /api/items]', err)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const item = await prisma.item.upsert({
      where: { upc: body.upc },
      update: body,
      create: body,
    })
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    console.error('[POST /api/items]', err)
    return NextResponse.json({ error: 'Failed to upsert item' }, { status: 500 })
  }
}
