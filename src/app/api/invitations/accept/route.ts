import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { audit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, name, password } = body

  if (!token || !name || !password) {
    return NextResponse.json({ error: 'Token, name, and password are required.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } })

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
  }
  if (invitation.acceptedAt) {
    return NextResponse.json({ error: 'Invitation already used.' }, { status: 410 })
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invitation expired.' }, { status: 410 })
  }

  // Check if user already exists (re-invite scenario)
  const existing = await prisma.user.findUnique({ where: { email: invitation.email } })
  if (existing) {
    return NextResponse.json({ error: 'An account for this email already exists.' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email: invitation.email,
      name: name.trim(),
      password: hashed,
      role: invitation.role,
      vendorId: invitation.vendorId ?? undefined,
      categoryIds: invitation.categoryIds,
      active: true,
    },
  })

  // Mark invitation accepted
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  })

  await audit({
    userId: user.id,
    userEmail: user.email,
    action: 'ACCEPT_INVITE',
    entity: 'User',
    entityId: user.id,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
