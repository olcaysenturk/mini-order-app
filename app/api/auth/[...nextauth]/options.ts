// /app/api/auth/[...nextauth]/options.ts (revize)
import type { NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/app/lib/db'
import bcrypt from 'bcryptjs'
// Define UserRole and TenantRole enums manually if not exported from @prisma/client
export enum UserRole {
  OWNER = 'OWNER',
  STAFF = 'STAFF',
  SUPERADMIN = 'SUPERADMIN',
  // Add other roles as needed
}

export enum TenantRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
  // Add other roles as needed
}

// ---- Tip güvenliği: Session/JWT genişletmeleri ----
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id: string
      role: UserRole
    }
    tenantId?: string | null
    tenantRole?: TenantRole | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
    tenantId?: string | null
    tenantRole?: TenantRole | null
  }
}

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

        // Sadece gerekli alanları çekelim
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true, role: true },
        })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? '',
          role: user.role as UserRole,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role as UserRole
        const mem = await pickDefaultMembership((user as any).id)
        token.tenantId = mem?.tenantId || null
        token.tenantRole = (mem?.role as TenantRole | undefined) ?? null
      }

      // Token var ama tenant bilgisi düşmüşse tekrar getir
      if (!token.tenantId && token.id) {
        const mem = await pickDefaultMembership(String(token.id))
        token.tenantId = mem?.tenantId || null
        token.tenantRole = (mem?.role as TenantRole | undefined) ?? null
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id)
        session.user.role = (token.role ?? UserRole.STAFF) as UserRole
      }
      session.tenantId = (token.tenantId as string | null) ?? null
      session.tenantRole = (token.tenantRole as TenantRole | null) ?? null
      return session
    },
  },

  pages: { signIn: '/login' },
}
