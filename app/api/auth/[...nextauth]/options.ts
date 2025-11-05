// app/api/auth/[...nextauth]/options.ts
import type { NextAuthOptions, DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/app/lib/db'
import bcrypt from 'bcryptjs'
import { ensureDefaultCategoriesForTenant } from '@/app/lib/seed-default-categories'
import { jwtVerify } from 'jose'

// 📨 Gmail SMTP helper'ları
import { sendMail } from '@/app/lib/mailer'
import { welcomeHtml } from '@/app/emails/welcome-html'

/* ================= Enums ================= */
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

/* =========== next-auth module augment =========== */
declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id: string
      role: UserRole
      isActive: boolean
      plan: BillingPlan
    }
    isPro?: boolean
    tenantId?: string | null
    tenantRole?: TenantRole | null

    // ⬇️ Impersonation bilgileri
    isImpersonated?: boolean
    impersonatorId?: string | null
    impersonatedAt?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
    isActive?: boolean
    plan?: BillingPlan
    tenantId?: string | null
    tenantRole?: TenantRole | null

    // ⬇️ Impersonation bilgileri
    isImpersonated?: boolean
    impersonatorId?: string | null
    impersonatedAt?: string | null
    impersonationScope?: 'tenant' | 'global'
  }
}

/* =========== Helpers =========== */
// Kullanıcıya ait en az bir tenant olmasını garanti eder (normal login’lerde)
async function ensureTenantForUser(userId: string, role?: UserRole) {
  const existing = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true, role: true },
  })
  if (existing) {
    // idempotent default kategori seed
    await ensureDefaultCategoriesForTenant(existing.tenantId)
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
      await ensureDefaultCategoriesForTenant(anyTenant.id)
      return { tenantId: anyTenant.id, tenantRole: TenantRole.OWNER }
    }

    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    const { tenantId } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: `${u?.name || 'Admin'}`, createdById: userId },
        select: { id: true },
      })
      await tx.membership.create({ data: { userId, tenantId: tenant.id, role: 'OWNER' } })
      await tx.branch.create({ data: { tenantId: tenant.id, name: 'Merkez', isActive: true } })
      return { tenantId: tenant.id }
    })

    await ensureDefaultCategoriesForTenant(tenantId)
    return { tenantId, tenantRole: TenantRole.OWNER }
  }

  return { tenantId: null, tenantRole: null }
}

const SECRET = process.env.NEXTAUTH_SECRET!
if (!SECRET) {
  throw new Error('NEXTAUTH_SECRET is required')
}

/* =========== NextAuth Options =========== */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  secret: SECRET,

  providers: [
    // 1) Normal Email+Şifre girişi
    Credentials({
      name: 'Email ve Şifre',
      id: 'credentials',
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Şifre', type: 'password' } },
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
            billingPlan: true,
          },
        })
        if (!user || !user.isActive) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? '',
          role: user.role as UserRole,
          isActive: !!user.isActive,
          plan: (user.billingPlan as BillingPlan) || BillingPlan.FREE,
        } as any
      },
    }),

    // 2) Admin’in imzaladığı token ile impersonate
    Credentials({
      id: 'impersonate',
      name: 'Impersonate',
      credentials: { token: { label: 'Token', type: 'text' } },
      async authorize(credentials) {
        const token = String(credentials?.token || '')
        if (!token) return null

        const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET)).catch(() => ({ payload: null as any }))
        if (!payload?.sub) return null

        const target = await prisma.user.findUnique({
          where: { id: String(payload.sub) },
          select: {
            id: true, email: true, name: true, role: true, isActive: true, billingPlan: true,
          },
        })
        if (!target || !target.isActive) return null

        return {
          id: target.id,
          email: target.email,
          name: target.name ?? '',
          role: target.role,
          isActive: true,
          plan: (target.billingPlan as BillingPlan) ?? 'FREE',
          __isImpersonated: true,
          __impersonatorId: (payload as any)?.impersonatorId ?? null,
          __impersonatedAt: new Date().toISOString(),
          __scope: ((payload as any)?.scope as 'tenant' | 'global') ?? 'tenant',
        } as any
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // İlk giriş anı
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role as UserRole
        token.isActive = Boolean((user as any).isActive)
        token.plan = ((user as any).plan as BillingPlan) ?? BillingPlan.FREE

        // ⬇️ Impersonate login geldiyse
        if ((user as any).__isImpersonated) {
          token.isImpersonated = true
          token.impersonatorId = (user as any).__impersonatorId ?? null
          token.impersonatedAt = (user as any).__impersonatedAt ?? new Date().toISOString()
          token.impersonationScope = (user as any).__scope ?? 'tenant'

          // Hedef kullanıcının mevcut ilk membership’ını bağla (tenant oluşturma yok)
          const mem = await prisma.membership.findFirst({
            where: { userId: String(token.id) },
            orderBy: { createdAt: 'asc' },
            select: { tenantId: true, role: true },
          })
          token.tenantId = mem?.tenantId ?? null
          token.tenantRole = (mem?.role as TenantRole | null) ?? null

          return token
        }

        // Normal login: tenant garantile + seed
        const ensured = await ensureTenantForUser(String(token.id), token.role as UserRole)
        token.tenantId = ensured.tenantId
        token.tenantRole = ensured.tenantRole
        return token
      }

      // Her istek öncesi tazeleme
      if (token.id) {
        const u = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: { isActive: true, role: true, billingPlan: true },
        })

        if (u) {
          token.isActive = !!u.isActive
          token.role = (u.role as UserRole) ?? token.role
          token.plan = (u.billingPlan as BillingPlan) ?? token.plan ?? BillingPlan.FREE
        }

        // Impersonate değilse ve tenantId boşsa garantiye al
        if (!token.isImpersonated && !token.tenantId) {
          const ensured = await ensureTenantForUser(String(token.id), token.role as UserRole)
          token.tenantId = ensured.tenantId
          token.tenantRole = ensured.tenantRole
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id)
        session.user.role = (token.role ?? UserRole.STAFF) as UserRole
        session.user.isActive = Boolean(token.isActive)
        session.user.plan = (token.plan as BillingPlan) ?? BillingPlan.FREE
      }
      session.isPro = session.user?.plan === BillingPlan.PRO
      session.tenantId = (token.tenantId as string | null) ?? null
      session.tenantRole = (token.tenantRole as TenantRole | null) ?? null

      // Impersonation alanları
      session.isImpersonated = !!token.isImpersonated
      session.impersonatorId = (token.impersonatorId as string | null) ?? null
      session.impersonatedAt = (token.impersonatedAt as string | null) ?? null

      return session
    },
  },

  // 🔔 İlk oturumda (sadece normal giriş) tek seferlik Hoş Geldiniz maili
  events: {
    async signIn({ user, account }) {
      try {
        // Impersonate provider ise e-posta gönderme
        if (account?.provider === 'impersonate') return

        const previousSessions = await prisma.session.count({ where: { userId: user.id } })
        if (previousSessions === 0 && user.email) {
          await sendMail({
            to: user.email,
            subject: `${process.env.APP_NAME || 'Perdexa'}’ya Hoş Geldiniz`,
            html: welcomeHtml({ userName: user.name || undefined }),
          })
        }
      } catch (e) {
        console.warn('welcome email send failed:', e)
      }
    },
  },

  pages: { signIn: '/auth/login' },
}
