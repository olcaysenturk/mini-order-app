// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const RegisterSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
})

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

    const { name, email, password } = parsed.data
    const lower = email.toLowerCase()

    const exists = await prisma.user.findUnique({ where: { email: lower } })
    if (exists) {
      return NextResponse.json({ error: 'email_in_use' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // Hepsini tek transaction’da oluştur
    const { user, tenant } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email: lower, passwordHash },
      })

      const tenant = await tx.tenant.create({
        data: {
          name: `${name}'s workspace`,
          createdById: user.id,
        },
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
  } catch (e: unknown) {
    // Prisma unique violation (ör. email benzersizliği)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'email_in_use' }, { status: 409 })
    }
    console.error('POST /api/auth/register error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
