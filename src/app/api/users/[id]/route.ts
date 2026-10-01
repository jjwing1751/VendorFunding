import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'

// PATCH /api/users/[id] — update role, active, vendorId, categoryIds (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const actor = session?.user as { id: string; email: string; role: string } | undefined
  if (!actor || actor.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json()
  const { role, active, vendorId, categoryIds } = body

  const before = await prisma.user.findUnique({
    where: { id },
    select: { role: true, active: true, vendorId: true, categoryIds: true },
  })
  if (!before) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  // Prevent admin from deactivating their own account
  if (id === actor.id && active === false) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
      ...(vendorId !== undefined && { vendorId: vendorId || null }),
      ...(categoryIds !== undefined && { categoryIds }),
    },
    select: { id: true, name: true, email: true, role: true, active: true, vendorId: true, categoryIds: true },
  })

  await audit({
    userId: actor.id,
    userEmail: actor.email,
    action: 'UPDATE',
    entity: 'User',
    entityId: id,
    before,
    after: { role: updated.role, active: updated.active, vendorId: updated.vendorId, categoryIds: updated.categoryIds },
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ user: updated })
}
