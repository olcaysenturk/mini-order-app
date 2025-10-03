// app/api/auth/[...nextauth]/options.ts
import type { NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/app/lib/db'
import bcrypt from 'bcryptjs'

// Varsayılan tenant seçimi (OWNER varsa onu, yoksa ilk membership)
async function pickDefaultMembership(userId: string) {
  const owner = await prisma.membership.findFirst({
    where: { userId, role: 'OWNER' },
    select: { tenantId: true, role: true },
  })
  if (owner) return owner

  const any = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true, role: true },
  })
  return any // yoksa null
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    Credentials({
      name: 'Email ve Şifre',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim().toLowerCase()
        const password = String(credentials?.password || '')
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? '',
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        const mem = await pickDefaultMembership((user as any).id)
        token.tenantId = mem?.tenantId || null
        token.tenantRole = mem?.role || null
      }

      if (!token.tenantId && token.id) {
        const mem = await pickDefaultMembership(String(token.id))
        token.tenantId = mem?.tenantId || null
        token.tenantRole = mem?.role || null
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      ;(session as any).tenantId = token.tenantId
      ;(session as any).tenantRole = token.tenantRole
      return session
    },
  },

  pages: { signIn: '/login' },
}
