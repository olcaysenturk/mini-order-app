// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'
type Ctx = { params: Promise<{ id: string }> }

const PatchBody = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(3).optional(),
  email: z.string().email().optional().or(z.literal('')).transform(v => (v === '' ? undefined : v)),
  address: z.string().optional(),
  note: z.string().optional(),
})

/** GET /api/customers/:id  (özet ile) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      // son 5 siparişin küçük özeti
      orders: {
        select: { id: true, createdAt: true, total: true, status: true, customerName: true, customerPhone: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })
  if (!customer) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(customer)
}

/** PATCH /api/customers/:id */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const json = await req.json()
    const parsed = PatchBody.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 422 })
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    if (typeof e === 'object' && e && (e as any)['code'] === 'P2025') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (typeof e === 'object' && e && (e as any)['code'] === 'P2002') {
      return NextResponse.json({ error: 'phone_taken' }, { status: 409 })
    }
    console.error('PATCH /customers/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** DELETE /api/customers/:id  (ilişkili sipariş yoksa sil) */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params

    const count = await prisma.order.count({ where: { customerId: id } })
    if (count > 0) {
      return NextResponse.json({ error: 'has_orders' }, { status: 400 })
    }

    await prisma.customer.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (typeof e === 'object' && e && (e as any)['code'] === 'P2025') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    console.error('DELETE /customers/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
