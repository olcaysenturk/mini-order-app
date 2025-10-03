// app/api/variants/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

/** ---------- Zod ---------- */
const CreateVariantSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, 'İsim zorunlu'),
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
})

/** 
 * GET /api/variants
 * Query: categoryId?, q?, take?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const sp = url.searchParams
    const categoryId = sp.get('categoryId') || undefined
    const q = (sp.get('q') || '').trim()
    const takeRaw = Number(sp.get('take') || '200')
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 500) : 200

    const where: any = { tenantId }
    if (categoryId) where.categoryId = categoryId
    if (q) where.name = { contains: q, mode: 'insensitive' }

    const variants = await prisma.variant.findMany({
      where,
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
      take,
      include: {
        category: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(variants)
  } catch (e) {
    console.error('GET /api/variants error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/**
 * POST /api/variants
 * Body: { categoryId, name, unitPrice }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const parsed = CreateVariantSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { categoryId, name, unitPrice } = parsed.data

    // Güvenlik: kategori bu tenant'a mı ait?
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, tenantId },
      select: { id: true },
    })
    if (!cat) {
      return NextResponse.json({ error: 'forbidden_category' }, { status: 403 })
    }

    // Varyant oluştur (DİKKAT: category değil, variant!)
    const variant = await prisma.variant.create({
      data: {
        tenantId,
        categoryId,
        name,
        unitPrice, // Prisma Decimal alanı number kabul eder
      },
    })

    return NextResponse.json(variant, { status: 201 })
  } catch (e: any) {
    // unique(categoryId, name) ihlali vs.
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'duplicate_variant_name_in_category' }, { status: 409 })
    }
    console.error('POST /api/variants error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
