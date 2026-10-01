import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.password || !user.active) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        // Audit log login
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          vendorId: user.vendorId,
          categoryIds: user.categoryIds,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { role: string; vendorId?: string; categoryIds?: string[] }
        token.role = u.role
        token.vendorId = u.vendorId
        token.categoryIds = u.categoryIds
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id: string }).id = token.sub!
        ;(session.user as { role: string }).role = token.role as string
        ;(session.user as { vendorId?: string }).vendorId = token.vendorId as string | undefined
        ;(session.user as { categoryIds?: string[] }).categoryIds = token.categoryIds as string[] | undefined
      }
      return session
    },
  },
}
