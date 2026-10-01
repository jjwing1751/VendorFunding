import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'

// GET /api/invitations — list invitations (admin only)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id: string; role: string } | undefined
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { invitedBy: { select: { name: true, email: true } } },
    take: 100,
  })

  return NextResponse.json({ invitations })
}

// POST /api/invitations — send invitation (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id: string; email: string; role: string } | undefined
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { email, role, vendorId, categoryIds } = body

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role are required.' }, { status: 400 })
  }

  const validRoles = ['VENDOR', 'BROKER', 'BUYER', 'MANAGER', 'ADMIN']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  }

  // Check for existing pending invite
  const existing = await prisma.invitation.findFirst({
    where: { email: email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
  })
  if (existing) {
    return NextResponse.json({ error: 'A pending invitation for this email already exists.' }, { status: 409 })
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existingUser) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7-day expiry

  const invitation = await prisma.invitation.create({
    data: {
      email: email.toLowerCase(),
      role,
      vendorId: vendorId || null,
      categoryIds: categoryIds || [],
      invitedById: user.id,
      expiresAt,
    },
  })

  await audit({
    userId: user.id,
    userEmail: user.email,
    action: 'INVITE',
    entity: 'Invitation',
    entityId: invitation.id,
    after: { email: invitation.email, role: invitation.role },
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  })

  // In production, send an email with the invite link. For now, return the token.
  const inviteUrl = `${process.env.NEXTAUTH_URL || ''}/accept-invite?token=${invitation.token}`

  return NextResponse.json({ ok: true, inviteUrl, token: invitation.token }, { status: 201 })
}
