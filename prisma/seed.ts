import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create default admin if none exists
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
  if (adminCount === 0) {
    const hashed = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin1234!', 12)
    const admin = await prisma.user.create({
      data: {
        email: process.env.SEED_ADMIN_EMAIL || 'admin@coborns.com',
        name: 'System Admin',
        password: hashed,
        role: 'ADMIN',
        active: true,
      },
    })
    console.log(`[seed] Created admin user: ${admin.email}`)
  } else {
    console.log('[seed] Admin already exists, skipping.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
