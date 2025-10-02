// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

/** ---------- Şemalar ---------- */
const StatusSchema = z.enum(['pending', 'processing', 'completed', 'cancelled'])

const LinesSchema = z.array(z.string().transform(s => s.trim())).max(6).optional()

const PatchItemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  variantId: z.string(),
  qty: z.number().int().positive(),
  width: z.number().int().nonnegative(),   // cm
  height: z.number().int().nonnegative(),  // cm (saklanır, hesapta kullanılmaz)
  unitPrice: z.union([z.number(), z.string()]).transform(v => {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1), // default 1
  note: z.string().nullable().optional(),
  _action: z.enum(['upsert', 'delete']).optional(), // default: upsert
})

const PatchBodySchema = z.object({
  note: z.string().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  status: StatusSchema.optional(),
  items: z.array(PatchItemSchema).optional(),
  storLines: LinesSchema,
  accessoryLines: LinesSchema,
})

type Ctx = { params: Promise<{ id: string }> }

/** ---------- GET /api/orders/:id (seq dahil) ---------- */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params

    // Sıra numarası (createdAt artan)
    const all = await prisma.order.findMany({
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    const index = all.findIndex(o => o.id === id)
    const seq = index === -1 ? null : index + 1

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { category: true, variant: true },
          orderBy: { id: 'asc' },
        },
        extras: true, // varsa ücretli ekstra satırlar
      },
    })
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ...order, seq })
  } catch (e) {
    console.error('GET /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** ---------- PATCH /api/orders/:id ---------- */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id: orderId } = await ctx.params
    const json = await req.json()
    const parsed = PatchBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const {
      note, customerName, customerPhone, status,
      items = [],
      storLines, accessoryLines,
    } = parsed.data

    // Bu siparişe ait mevcut kalem id’leri (sahiplik kontrolü)
    const owned = await prisma.orderItem.findMany({
      where: { orderId },
      select: { id: true },
    })
    const ownedSet = new Set(owned.map(o => o.id))

    // Silinecekler
    const toDeleteIds = items
      .filter(i => (i._action ?? 'upsert') === 'delete' && i.id && ownedSet.has(String(i.id)))
      .map(i => String(i.id))

    // Upsert edilecekler
    const upserts = items.filter(i => (i._action ?? 'upsert') === 'upsert')

    // Toplayıp tek seferde transaction yapalım
    const ops: Prisma.PrismaPromise<unknown>[] = []

    if (toDeleteIds.length) {
      ops.push(
        prisma.orderItem.deleteMany({
          where: { orderId, id: { in: toDeleteIds } },
        })
      )
    }

    for (const it of upserts) {
      const qtyInt    = Math.max(1, Math.trunc(Number(it.qty ?? 0)))
      const widthInt  = Math.max(0, Math.trunc(Number(it.width ?? 0)))
      const heightInt = Math.max(0, Math.trunc(Number(it.height ?? 0))) // sakla
      const price     = new Prisma.Decimal(it.unitPrice ?? 0)
      const density   = new Prisma.Decimal(Number(it.fileDensity ?? 1))

      // === YENİ FORMÜL ===
      // subtotal = unitPrice * qty * (width/100) * fileDensity
      const subtotal  = price.mul(new Prisma.Decimal(widthInt).div(100))
                            .mul(density)
                            .mul(qtyInt)

      const lineData = {
        qty: qtyInt,
        width: widthInt,
        height: heightInt,
        unitPrice: price,
        fileDensity: density,
        subtotal,
        note: (it.note ?? null) as string | null,
        category: { connect: { id: String(it.categoryId) } },
        variant:  { connect: { id: String(it.variantId) } },
      } as const

      if (it.id) {
        if (!ownedSet.has(String(it.id))) {
          return NextResponse.json({ error: 'forbidden_item_update' }, { status: 403 })
        }
        ops.push(
          prisma.orderItem.update({
            where: { id: String(it.id) },
            data: lineData,
          })
        )
      } else {
        ops.push(
          prisma.orderItem.create({
            data: {
              order: { connect: { id: orderId } },
              ...lineData,
            },
          })
        )
      }
    }

    // Başlık güncelle (total HARİÇ — total birazdan hesaplanacak)
    const storClean = (storLines ?? []).map(s => s.trim()).filter(Boolean)
    const accClean  = (accessoryLines ?? []).map(s => s.trim()).filter(Boolean)

    const headerPatch: Prisma.OrderUpdateInput = {}
    if (typeof note !== 'undefined') headerPatch.note = note
    if (typeof status !== 'undefined') headerPatch.status = status
    if (typeof customerName !== 'undefined') headerPatch.customerName = customerName.trim()
    if (typeof customerPhone !== 'undefined') headerPatch.customerPhone = customerPhone.trim()
    if (typeof storLines !== 'undefined') headerPatch.storLines = storClean as unknown as Prisma.InputJsonValue
    if (typeof accessoryLines !== 'undefined') headerPatch.accessoryLines = accClean as unknown as Prisma.InputJsonValue

    if (Object.keys(headerPatch).length) {
      ops.push(prisma.order.update({ where: { id: orderId }, data: headerPatch }))
    }

    if (ops.length) {
     await prisma.$transaction(ops)
    }

    // === Toplamı tek sorguda hesapla (OrderItem + OrderExtra) ===
    const totalRow = await prisma.$queryRaw<{ total: number }[]>`
      SELECT
        COALESCE((SELECT SUM("subtotal")::float FROM "OrderItem"  WHERE "orderId" = ${orderId}), 0)
        +
        COALESCE((SELECT SUM("subtotal")::float FROM "OrderExtra" WHERE "orderId" = ${orderId}), 0)
        AS total
    `
    const total = totalRow?.[0]?.total ?? 0

    await prisma.order.update({
      where: { id: orderId },
      data: { total: new Prisma.Decimal(total) },
    })

    // Güncel siparişi döndür
    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { category: true, variant: true },
          orderBy: { id: 'asc' },
        },
        extras: true,
      },
    })
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('PATCH /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** ---------- DELETE /api/orders/:id ---------- */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    await prisma.order.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
