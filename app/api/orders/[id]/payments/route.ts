// app/api/orders/[id]/payments/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'

// ---- Zod schemas
const AmountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v))
  .refine((n) => Number.isFinite(n) && n > 0, { message: 'amount_positive' })

const BodySchema = z.object({
  amount: AmountSchema,
  method: z.enum(['CASH', 'TRANSFER', 'CARD']),
  note: z.string().trim().optional().nullable(),
  paidAt: z.union([z.string(), z.date()]).optional(),
})

// ---- Helpers
async function requireTenant() {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  const userId = session?.user?.id as string | undefined
  if (!tenantId || !session?.user) return null
  return { tenantId, userId }
}

function n(v: unknown) {
  return Number(v ?? 0)
}

/* ================== POST: Ödeme ekle ==================
   POST /api/orders/:id/payments
   Body: { amount, method: 'CASH'|'TRANSFER'|'CARD', note?, paidAt? }
======================================================== */
export async function POST(req: Request, ctx: any) {
  try {
    const auth = await requireTenant()
    if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { tenantId, userId } = auth

    const orderId = ctx?.params?.id as string | undefined
    if (!orderId) return NextResponse.json({ error: 'missing_order_id' }, { status: 400 })

    const json = await req.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }
    const { amount, method, note, paidAt } = parsed.data

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, netTotal: true },
    })
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const agg = await prisma.orderPayment.aggregate({
      where: { orderId, tenantId },
      _sum: { amount: true },
    })
    const paidSoFar = n(agg._sum.amount)
    const netTotal = n(order.netTotal)
    const remaining = Math.max(0, netTotal - paidSoFar)

    if (amount > remaining + 1e-6) {
      return NextResponse.json(
        { error: 'amount_exceeds_remaining', remaining },
        { status: 400 }
      )
    }

    await prisma.orderPayment.create({
      data: {
        tenantId,
        orderId,
        method,
        amount: new Prisma.Decimal(amount),
        note: note && note.length ? note : null,
        createdById: userId ?? null,
        ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
      },
    })

    const payments = await prisma.orderPayment.findMany({
      where: { orderId, tenantId },
      orderBy: { paidAt: 'asc' },
      select: { id: true, method: true, note: true, paidAt: true, amount: true, createdById: true },
    })
    const totalPaid = payments.reduce((a, p) => a + Number(p.amount), 0)
    const newRemaining = Math.max(0, netTotal - totalPaid)

    return NextResponse.json({
      ok: true,
      orderId,
      totals: { netTotal, totalPaid, remaining: newRemaining },
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    })
  } catch (e) {
    console.error('POST /orders/:id/payments error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/* ============== GET: Ödemeleri listele ==============
   GET /api/orders/:id/payments
====================================================== */
export async function GET(_req: Request, ctx: any) {
  try {
    const auth = await requireTenant()
    if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { tenantId } = auth

    const orderId = ctx?.params?.id as string | undefined
    if (!orderId) return NextResponse.json({ error: 'missing_order_id' }, { status: 400 })

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, netTotal: true },
    })
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const payments = await prisma.orderPayment.findMany({
      where: { orderId, tenantId },
      orderBy: { paidAt: 'asc' },
      select: { id: true, method: true, note: true, paidAt: true, amount: true, createdById: true },
    })

    const totalPaid = payments.reduce((a, p) => a + Number(p.amount), 0)
    const remaining = Math.max(0, Number(order.netTotal) - totalPaid)

    return NextResponse.json({
      orderId,
      totals: { netTotal: Number(order.netTotal), totalPaid, remaining },
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    })
  } catch (e) {
    console.error('GET /orders/:id/payments error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
