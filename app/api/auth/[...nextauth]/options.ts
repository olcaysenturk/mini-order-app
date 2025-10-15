// app/api/auth/[...nextauth]/options.ts
import type { NextAuthOptions, DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/app/lib/db'
import bcrypt from 'bcryptjs'

// ---- Enum'ları (tip güvenliği için) tanımla
export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  SUPERADMIN = 'SUPERADMIN',
}

export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

// ---- next-auth module augment (session/jwt alanlarını genişlet)
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

// Kullanıcıya ait en az bir tenant olmasını garanti eder, yoksa (SUPERADMIN ise) oluşturur.
async function ensureTenantForUser(userId: string, role?: UserRole) {
  // 1) Zaten bir membership varsa onu kullan
  const existing = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true, role: true },
  })
  if (existing) {
    return { tenantId: existing.tenantId, tenantRole: existing.role as TenantRole }
  }

  // 2) SUPERADMIN ise: var olan ilk tenant'a OWNER olarak ekle, yoksa sıfırdan kur
  if (role === UserRole.SUPERADMIN) {
    const anyTenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (anyTenant) {
      await prisma.membership.upsert({
        where: { userId_tenantId: { userId, tenantId: anyTenant.id } },
        update: { role: 'OWNER' },
        create: { userId, tenantId: anyTenant.id, role: 'OWNER' },
      })
      return { tenantId: anyTenant.id, tenantRole: TenantRole.OWNER }
    }

    // hiç tenant yoksa: tenant + OWNER membership + default branch ("Merkez")
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const { tenantId } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: `${u?.name || 'Admin'}'s workspace`, createdById: userId },
        select: { id: true },
      })

      await tx.membership.create({
        data: { userId, tenantId: tenant.id, role: 'OWNER' },
      })

      // default branch
      await tx.branch.create({
        data: { tenantId: tenant.id, name: 'Merkez', isActive: true },
      })

      return { tenantId: tenant.id }
    })

    return { tenantId, tenantRole: TenantRole.OWNER }
  }

  // 3) Normal kullanıcı & membership yok → boş dön (ilk üyelik oluşana kadar)
  return { tenantId: null, tenantRole: null }
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
    // JWT: login anında ve her istek öncesi çalışır
    async jwt({ token, user }) {
      // İlk login anı: user dolu gelir
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role as UserRole

        const ensured = await ensureTenantForUser(String(token.id), token.role as UserRole)
        token.tenantId = ensured.tenantId
        token.tenantRole = ensured.tenantRole
        return token
      }

      // Sonradan tenantId düşmüşse yeniden garanti altına al
      if (!token.tenantId && token.id) {
        const ensured = await ensureTenantForUser(String(token.id), token.role as UserRole)
        token.tenantId = ensured.tenantId
        token.tenantRole = ensured.tenantRole
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
