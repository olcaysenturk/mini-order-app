// app/api/categories/[id]/variants/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
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

/** GET /api/categories/:id/variants -> bu kategoriye ait varyantlar */
export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const variants = await prisma.variant.findMany({
    where: { categoryId: id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(variants)
}

/** POST /api/categories/:id/variants -> kategoriye yeni varyant ekle */
export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { id } = await ctx.params
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
        unitPrice: parsed.data.unitPrice, // Decimal alanı, number kabul eder
      },
    })

    return NextResponse.json(variant, { status: 201 })
  } catch (e) {
    console.error('POST /categories/[id]/variants error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
