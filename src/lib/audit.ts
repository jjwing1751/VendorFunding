import { prisma } from '@/lib/prisma'

interface AuditParams {
  userId?: string
  userEmail?: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'INVITE' | 'ACCEPT_INVITE'
  entity: string
  entityId?: string
  before?: unknown
  after?: unknown
  ip?: string
}

export async function audit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userEmail: params.userEmail,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ? (params.before as object) : undefined,
        after: params.after ? (params.after as object) : undefined,
        ip: params.ip,
      },
    })
  } catch {
    // Never let audit failure crash the main operation
    console.error('[audit] failed to write log')
  }
}
