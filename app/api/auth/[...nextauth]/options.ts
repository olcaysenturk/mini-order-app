// app/api/auth/[...nextauth]/options.ts
import type { NextAuthOptions, DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/app/lib/db'
import bcrypt from 'bcryptjs'
import { ensureDefaultCategoriesForTenant } from '@/app/lib/seed-default-categories'

// 📨 Gmail SMTP helper'ları (önceki adımda eklemiştik)
import { sendMail } from '@/app/lib/mailer'
import { welcomeHtml } from '@/app/emails/welcome-html'

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
      plan: BillingPlan
    }
    isPro?: boolean
    tenantId?: string | null
    tenantRole?: TenantRole | null
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
  }
}

// Kullanıcıya ait en az bir tenant olmasını garanti eder
async function ensureTenantForUser(userId: string, role?: UserRole) {
  // Kullanıcının bir üyeliği varsa onu kullan
  const existing = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true, role: true },
  })
  if (existing) {
    // Mevcut tenant’ta default kategorileri idempotent şekilde garanti et
    await ensureDefaultCategoriesForTenant(existing.tenantId)
    return { tenantId: existing.tenantId, tenantRole: existing.role as TenantRole }
  }

  // Sadece SUPERADMIN için otomatik tenant açma kuralın korunuyor
  if (role === UserRole.SUPERADMIN) {
    // Varsa ilk tenant'a bağla
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
      // Mevcut tenant’ta default kategorileri garanti et
      await ensureDefaultCategoriesForTenant(anyTenant.id)
      return { tenantId: anyTenant.id, tenantRole: TenantRole.OWNER }
    }

    // Hiç tenant yoksa yenisini oluştur
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    // Not: seed fonksiyonunu transaction DIŞINDA çağıracağız
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

    // ✅ Transaction bitti, şimdi default kategorileri yükle (idempotent)
    await ensureDefaultCategoriesForTenant(tenantId)

    return { tenantId, tenantRole: TenantRole.OWNER }
  }

  // Normal kullanıcılar için burada tenant oluşturma kuralın yoksa null döner
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
            billingPlan: true,
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
          plan: (user.billingPlan as BillingPlan) || BillingPlan.FREE,
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

        // 🔑 Tenant garantile + default kategorileri seed et (idempotent)
        const ensured = await ensureTenantForUser(String(token.id), token.role as UserRole)
        token.tenantId = ensured.tenantId
        token.tenantRole = ensured.tenantRole
        return token
      }

      // Her çağrıda tazele (rol/aktiflik/plan)
      if (token.id) {
        const u = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: {
            isActive: true,
            role: true,
            billingPlan: true,
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
        session.user.plan = (token.plan as BillingPlan) ?? BillingPlan.FREE
      }
      session.isPro = session.user?.plan === BillingPlan.PRO
      session.tenantId = (token.tenantId as string | null) ?? null
      session.tenantRole = (token.tenantRole as TenantRole | null) ?? null
      return session
    },
  },

  // 🔔 İlk oturumda tek seferlik Hoş Geldiniz maili
  events: {
    async signIn({ user }) {
      try {
        // Bu kullanıcı için daha önce hiç session açılmış mı?
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
