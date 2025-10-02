// app/api/categories/[id]/variants/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

// İsteğe göre: hem Next 14 hem 15 ile uyumlu küçük yardımcı
type Ctx<P extends Record<string, string>> =
  | { params: P }
  | { params: Promise<P> }

async function getParams<P extends Record<string, string>>(ctx: Ctx<P>) {
  return await Promise.resolve(ctx.params)
}

const VariantSchema = z.object({
  name: z.string().min(1),
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
})

export async function POST(req: NextRequest, ctx: Ctx<{ id: string }>) {
  try {
    const { id } = await getParams(ctx) // ← params'ı await edin
    const json = await req.json()
    const parsed = VariantSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { name, unitPrice } = parsed.data
    const created = await prisma.variant.create({
      data: {
        name,
        unitPrice: new Prisma.Decimal(unitPrice),
        categoryId: id,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('POST /api/categories/[id]/variants error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
