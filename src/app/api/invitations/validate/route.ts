import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 })
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  })

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found or already used.' }, { status: 404 })
  }

  if (invitation.acceptedAt) {
    return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 410 })
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired. Please request a new one.' }, { status: 410 })
  }

  return NextResponse.json({
    email: invitation.email,
    role: invitation.role,
  })
}
