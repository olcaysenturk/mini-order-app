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
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }   // 👈 burada Promise!
) {
  const { id } = await ctx.params

  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Kategori bu tenant’a mı ait?
  const category = await prisma.category.findFirst({
    where: { id, tenantId },
    select: { id: true },
  })
  if (!category) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const variants = await prisma.variant.findMany({
    where: { categoryId: category.id, tenantId },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(variants)
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
