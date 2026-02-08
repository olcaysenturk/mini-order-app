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
    
    // Decimal arithmetic for precision
    const paidSoFar = agg._sum.amount ?? new Prisma.Decimal(0)
    const netTotal = order.netTotal ?? new Prisma.Decimal(0)
    const remaining = netTotal.sub(paidSoFar)
    const amountDec = new Prisma.Decimal(amount)

    // Allow a very small epsilon for floating point drift if any, 
    // but primarily rely on Decimal comparison.
    // If amount > remaining (strictly), reject.
    // We add a tiny epsilon (0.005) to remaining to allow for rounding differences if any,
    // though Decimal should be exact.
    if (amountDec.gt(remaining.add(new Prisma.Decimal('0.009')))) {
      return NextResponse.json(
        { error: 'amount_exceeds_remaining', remaining: Number(remaining) },
        { status: 400 }
      )
    }

    await prisma.orderPayment.create({
      data: {
        tenantId,
        orderId,
        method,
        amount: amountDec, // Use decimal directly
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
    const totalPaidDec = payments.reduce((a, p) => a.add(p.amount), new Prisma.Decimal(0))
    const newRemainingDec = netTotal.sub(totalPaidDec)
    const newRemaining = Number(newRemainingDec) > 0 ? Number(newRemainingDec) : 0

    return NextResponse.json({
      ok: true,
      orderId,
      totals: { 
        netTotal: Number(netTotal), 
        totalPaid: Number(totalPaidDec), 
        remaining: newRemaining 
      },
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

    const netTotal = order.netTotal ?? new Prisma.Decimal(0)
    const totalPaidDec = payments.reduce((a, p) => a.add(p.amount), new Prisma.Decimal(0))
    const remainingDec = netTotal.sub(totalPaidDec)
    const remaining = Number(remainingDec) > 0 ? Number(remainingDec) : 0

    return NextResponse.json({
      orderId,
      totals: { 
        netTotal: Number(netTotal), 
        totalPaid: Number(totalPaidDec), 
        remaining 
      },
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    })
  } catch (e) {
    console.error('GET /orders/:id/payments error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
