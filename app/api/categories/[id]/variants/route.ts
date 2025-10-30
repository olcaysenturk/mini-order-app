// app/api/categories/[id]/variants/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  name: z.string().trim().min(1, 'İsim zorunlu'),
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
})

/** GET /api/categories/:id/variants (tenant scoped) */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const take = Math.min(Math.max(parseInt(searchParams.get('take') || '20', 10), 1), 100)
  const q = (searchParams.get('q') || '').trim()
  const sort = (searchParams.get('sort') || 'name_asc') as 'name_asc' | 'price_asc' | 'price_desc'
  const cursor = searchParams.get('cursor') // variant.id

  const category = await prisma.category.findFirst({
    where: { id, tenantId },
    select: { id: true },
  })
  if (!category) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const where = {
    tenantId,
    categoryId: category.id,
    ...(q
      ? { name: { contains: q, mode: 'insensitive' as const } }
      : {}),
  }

  const orderBy =
    sort === 'price_asc' ? { unitPrice: 'asc' as const } :
    sort === 'price_desc' ? { unitPrice: 'desc' as const } :
    { name: 'asc' as const }

  const rows = await prisma.variant.findMany({
    where,
    orderBy,
    take: take + 1, // nextCursor var mı öğrenmek için
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasNext = rows.length > take
  const items = hasNext ? rows.slice(0, take) : rows
  const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null
  const total = await prisma.variant.count({ where })

  return NextResponse.json({ items, nextCursor, total })
}

/** POST /api/categories/:id/variants (tenant scoped) */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }   // 👈 burada da Promise!
) {
  const { id } = await ctx.params

  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Kategori bu tenant’a mı ait?
    const category = await prisma.category.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!category) return NextResponse.json({ error: 'not_found' }, { status: 404 })

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
        tenantId,                 // ⬅️ şemada zorunlu
        categoryId: category.id,  // ⬅️ path’ten
        name: parsed.data.name,
        unitPrice: parsed.data.unitPrice,
      },
    })
    return NextResponse.json(variant, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      // @@unique([categoryId, name]) çakışması
      return NextResponse.json({ error: 'duplicate_name' }, { status: 409 })
    }
    console.error('POST /categories/[id]/variants error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
