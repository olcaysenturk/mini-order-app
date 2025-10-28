// app/api/auth/[...nextauth]/options.ts
import type { NextAuthOptions, DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/app/lib/db'
import bcrypt from 'bcryptjs'

// ---- Enums ----
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

export enum BillingPlan {
  FREE = 'FREE',
  PRO = 'PRO',
}

// ---- next-auth module augment ----
declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id: string
      role: UserRole
      isActive: boolean
      plan: BillingPlan           // ✅ plan bilgisi session.user altında
    }
    isPro?: boolean               // ✅ kolay kullanım için helper
    tenantId?: string | null
    tenantRole?: TenantRole | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
    isActive?: boolean
    plan?: BillingPlan           // ✅ plan JWT üzerinde de taşınır
    tenantId?: string | null
    tenantRole?: TenantRole | null
  }
}

// Kullanıcıya ait en az bir tenant olmasını garanti eder
async function ensureTenantForUser(userId: string, role?: UserRole) {
  const existing = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true, role: true },
  })
  if (existing) {
    return { tenantId: existing.tenantId, tenantRole: existing.role as TenantRole }
  }

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

    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const { tenantId } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: `${u?.name || 'Admin'}`, createdById: userId },
        select: { id: true },
      })

      await tx.membership.create({
        data: { userId, tenantId: tenant.id, role: 'OWNER' },
      })

      await tx.branch.create({
        data: { tenantId: tenant.id, name: 'Merkez', isActive: true },
      })

      return { tenantId: tenant.id }
    })

    return { tenantId, tenantRole: TenantRole.OWNER }
  }

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
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            isActive: true,
            billingPlan: true,               // ✅ DB alanı: billingPlan (FREE|PRO)
            // billingNextDueAt: true,       // (istersen ileride ekleyebilirsin)
          },
        })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? '',
          role: user.role as UserRole,
          isActive: !!user.isActive,
          plan: (user.billingPlan as BillingPlan) || BillingPlan.FREE, // ✅ plan başlangıç
        } as any
      },
    }),
  ],

  callbacks: {
    // JWT: login anında ve her istekten önce çalışır
    async jwt({ token, user }) {
      // İlk login anı
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role as UserRole
        token.isActive = Boolean((user as any).isActive)
        token.plan = ((user as any).plan as BillingPlan) ?? BillingPlan.FREE

        const ensured = await ensureTenantForUser(String(token.id), token.role as UserRole)
        token.tenantId = ensured.tenantId
        token.tenantRole = ensured.tenantRole
        return token
      }

      // Her çağrıda tazele (rol/aktiflik/plan değişimleri anında yansısın)
      if (token.id) {
        const u = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: {
            isActive: true,
            role: true,
            billingPlan: true,              // ✅ plan’ı da tazele
          },
        })
        if (u) {
          token.isActive = !!u.isActive
          token.role = (u.role as UserRole) ?? token.role
          token.plan = (u.billingPlan as BillingPlan) ?? token.plan ?? BillingPlan.FREE
        }

        // Sonradan tenant düşmüşse tekrar garantiye al
        if (!token.tenantId) {
          const ensured = await ensureTenantForUser(String(token.id), token.role as UserRole)
          token.tenantId = ensured.tenantId
          token.tenantRole = ensured.tenantRole
        }
      }
      return token
    },

    // Session objesi
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id)
        session.user.role = (token.role ?? UserRole.STAFF) as UserRole
        session.user.isActive = Boolean(token.isActive)
        session.user.plan = (token.plan as BillingPlan) ?? BillingPlan.FREE // ✅ session.user.plan
      }
      session.isPro = session.user?.plan === BillingPlan.PRO               // ✅ helper
      session.tenantId = (token.tenantId as string | null) ?? null
      session.tenantRole = (token.tenantRole as TenantRole | null) ?? null
      return session
    },
  },

  pages: { signIn: '/auth/login' },
}
