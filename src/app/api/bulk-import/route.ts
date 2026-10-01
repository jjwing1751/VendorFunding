import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface ImportRow {
  vendorName?: string
  vendorAccountNum?: string
  upc?: string
  description?: string
  fundingType?: string
  startDate?: string
  endDate?: string
  totalFunding?: string | number
  ps3Retail?: string | number
  ps4Retail?: string | number
  ps5Retail?: string | number
  regularCaseCost?: string | number
  dealCaseCost?: string | number
  banners?: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const { rows, filename } = await request.json()

    const batch = await prisma.importBatch.create({
      data: {
        filename: filename ?? 'upload',
        rowCount: rows.length,
      },
    })

    const dealIds: string[] = []
    let okCount = 0
    let warnCount = 0
    let errCount = 0

    for (const row of rows as ImportRow[]) {
      try {
        // Upsert vendor
        const vendor = await prisma.vendor.upsert({
          where: { accountNum: row.vendorAccountNum ?? '__NONE__' },
          update: { name: row.vendorName ?? 'Unknown' },
          create: {
            name: row.vendorName ?? 'Unknown',
            accountNum: row.vendorAccountNum,
          },
        })

        // Upsert item if UPC provided
        if (row.upc) {
          await prisma.item.upsert({
            where: { upc: row.upc },
            update: { description: row.description ?? '' },
            create: {
              upc: row.upc,
              description: row.description ?? '',
              vendorId: vendor.id,
            },
          })
        }

        const banners = row.banners
          ? (row.banners.split(/[,\s]+/).filter(Boolean) as ('COB' | 'MPF' | 'CW' | 'TAD' | 'HORN')[])
          : []

        const deal = await prisma.deal.create({
          data: {
            vendorId: vendor.id,
            fundingType: (row.fundingType as 'OI' | 'BB' | 'LS' | 'PA' | 'SBP' | 'AMAP' | 'TPR' | 'AWG') ?? 'OI',
            startDate: new Date(row.startDate ?? Date.now()),
            endDate: new Date(row.endDate ?? Date.now()),
            totalFunding: row.totalFunding ? Number(row.totalFunding) : undefined,
            ps3Retail: row.ps3Retail ? Number(row.ps3Retail) : undefined,
            ps4Retail: row.ps4Retail ? Number(row.ps4Retail) : undefined,
            ps5Retail: row.ps5Retail ? Number(row.ps5Retail) : undefined,
            regularCaseCost: row.regularCaseCost ? Number(row.regularCaseCost) : undefined,
            dealCaseCost: row.dealCaseCost ? Number(row.dealCaseCost) : undefined,
            banners,
            notes: row.notes,
            status: 'PENDING_APPROVAL',
            importBatchId: batch.id,
            approvals: {
              create: [
                { step: 1, approverRole: 'BUYER' },
                { step: 2, approverRole: 'MANAGER' },
                { step: 3, approverRole: 'ADMIN' },
              ],
            },
          },
        })

        dealIds.push(deal.id)
        okCount++
      } catch {
        errCount++
      }
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { okCount, warnCount, errCount },
    })

    return NextResponse.json({ batchId: batch.id, ok: okCount, warn: warnCount, err: errCount, dealIds })
  } catch (err) {
    console.error('[POST /api/bulk-import]', err)
    return NextResponse.json({ error: 'Bulk import failed' }, { status: 500 })
  }
}
