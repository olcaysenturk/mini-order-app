// app/api/categories/[id]/variants/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'

type Params = { id: string }

const BodySchema = z.object({
  name: z.string().trim().min(1, 'İsim zorunlu'),
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
})

/** GET /api/categories/:id/variants -> kategorinin varyantları (login zorunlu) */
export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Kategori var mı?
  const cat = await prisma.category.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!cat) {
    return NextResponse.json({ error: 'category_not_found' }, { status: 404 })
  }

  const variants = await prisma.variant.findMany({
    where: { categoryId: id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(variants)
}

/** POST /api/categories/:id/variants -> kategoriye yeni varyant ekle (login zorunlu) */
export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await ctx.params

    // Kategori var mı?
    const cat = await prisma.category.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!cat) {
      return NextResponse.json({ error: 'category_not_found' }, { status: 404 })
    }

    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const variant = await prisma.variant.create({
      data: {
        categoryId: id,
        name: parsed.data.name,
        unitPrice: parsed.data.unitPrice, // Decimal alanına number verilebilir
      },
    })

    return NextResponse.json(variant, { status: 201 })
  } catch (e: unknown) {
    // Aynı kategori içinde aynı ad varsa (@@unique([categoryId, name]))
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'duplicate_variant_name' }, { status: 409 })
    }
    console.error('POST /categories/[id]/variants error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
