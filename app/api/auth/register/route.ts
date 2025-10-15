// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

const RegisterSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9._-]+$/i).optional(),
})

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accent temizle
    .replace(/[^a-z0-9._-]+/g, '-') // izinli olmayanları '-'
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .slice(0, 30) || 'user'

async function getAvailableUsername(tx: Prisma.TransactionClient, base: string) {
  const root = base || 'user'
  const tryUser = async (u: string) =>
    (await tx.user.findUnique({ where: { username: u } })) ? null : u

  // önce direkt base
  const direct = await tryUser(root)
  if (direct) return direct

  // 1..9999 deneyelim
  for (let i = 2; i < 10000; i++) {
    const candidate = `${root}-${i}`
    const ok = await tryUser(candidate)
    if (ok) return ok
  }
  // teorik olarak zor; fallback
  return `${root}-${crypto.randomUUID().slice(0, 8)}`
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = RegisterSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { name, email, password, username } = parsed.data
    const lower = email.toLowerCase()
    const passwordHash = await bcrypt.hash(password, 12)

    // Tek transaction
    const { user, tenant } = await prisma.$transaction(async (tx) => {
      // e-posta benzersiz mi?
      const exists = await tx.user.findUnique({ where: { email: lower } })
      if (exists) {
        throw Object.assign(new Error('email_in_use'), { code: 'EMAIL_IN_USE' })
      }

      // username belirle
      const base =
        username?.toLowerCase() ||
        slugify(lower.split('@')[0]) ||
        slugify(name)

      const uniqueUsername = await getAvailableUsername(tx, base)

      const user = await tx.user.create({
        data: { name, email: lower, passwordHash, username: uniqueUsername },
        select: { id: true },
      })

      const tenant = await tx.tenant.create({
        data: { name: `${name}'s workspace`, createdById: user.id },
        select: { id: true },
      })

      await tx.membership.create({
        data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
      })

      return { user, tenant }
    })

    return NextResponse.json(
      { ok: true, userId: user.id, tenantId: tenant.id },
      { status: 201 }
    )
  } catch (e: any) {
    if (e?.code === 'EMAIL_IN_USE') {
      return NextResponse.json({ error: 'email_in_use' }, { status: 409 })
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // unique violation (email/username çakışması)
      return NextResponse.json({ error: 'unique_violation' }, { status: 409 })
    }
    console.error('POST /api/auth/register error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
