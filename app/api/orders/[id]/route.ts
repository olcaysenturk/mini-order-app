// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

/* ================= Zod Schemas ================ */
const StatusSchema = z.enum(['pending', 'processing', 'completed', 'cancelled'])
const LinesSchema  = z.array(z.string().transform(s => s.trim())).max(6).optional()

// ✅ "YYYY-MM-DD" veya null kabul eden tarih şeması
const YmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

const PatchItemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  variantId: z.string(),
  qty: z.number().int().positive(),
  width: z.number().int().nonnegative(),    // cm
  height: z.number().int().nonnegative(),   // cm
  unitPrice: z.union([z.number(), z.string()]).transform(v => {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1), // default 1
  note: z.string().nullable().optional(),

  // ✅ eklendi
  lineStatus: StatusSchema.default('pending'),
  slotIndex: z.number().int().nullable().optional(),

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
  deliveryAt: YmdSchema,

  // ✅ sadece orderType eklendi (0: Yeni Sipariş, 1: Fiyat Teklifi)
  orderType: z.union([z.literal(0), z.literal(1)]).optional(),
})

type Ctx = { params: Promise<{ id: string }> }

/* =============== GET /api/orders/:id ================= */
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
        extras: true,
        branch: { select: { id: true, name: true, code: true, phone: true, address: true } },
        payments: { orderBy: { paidAt: 'asc' } },
      },
    })
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const paidTotal = (order.payments ?? []).reduce((a, p) => a + Number(p.amount), 0)
    const balance   = Number(order.netTotal) - paidTotal

    return NextResponse.json({
      ...order,
      seq,
      total:    Number(order.total),
      discount: Number(order.discount),
      netTotal: Number(order.netTotal),
      orderType: Number(order.orderType ?? 0), // ✅ eklendi
      items: order.items.map(it => ({
        ...it,
        unitPrice:   Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal:    Number(it.subtotal),
        // lineStatus ve slotIndex açıkça aktarılıyor
        lineStatus: it.lineStatus,
        slotIndex: it.slotIndex,
      })),
      payments: order.payments.map(p => ({
        ...p,
        amount: Number(p.amount),
      })),
      paidTotal,
      balance,
    })
  } catch (e) {
    console.error('GET /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/* ============== PATCH /api/orders/:id ================= */
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
      note,
      customerName,
      customerPhone,
      status,
      items = [],
      storLines,
      accessoryLines,
      deliveryAt, // ✅ frontend’den gelen "YYYY-MM-DD" | null
      orderType,  // ✅ eklendi
    } = parsed.data

    // Bu siparişe ait mevcut kalem id’leri (sahiplik kontrolü)
    const owned = await prisma.orderItem.findMany({ where: { orderId }, select: { id: true } })
    const ownedSet = new Set(owned.map(o => o.id))

    // Silinecekler
    const toDeleteIds = items
      .filter(i => (i._action ?? 'upsert') === 'delete' && i.id && ownedSet.has(String(i.id)))
      .map(i => String(i.id))

    // Upsert edilecekler
    const upserts = items.filter(i => (i._action ?? 'upsert') === 'upsert')

    const ops: Prisma.PrismaPromise<unknown>[] = []

    // Sil
    if (toDeleteIds.length) {
      ops.push(
        prisma.orderItem.deleteMany({
          where: { orderId, id: { in: toDeleteIds } },
        })
      )
    }

    // Upsert
    for (const it of upserts) {
      const qtyInt    = Math.max(1, Math.trunc(Number(it.qty ?? 0)))
      const widthInt  = Math.max(0, Math.trunc(Number(it.width ?? 0)))
      const heightInt = Math.max(0, Math.trunc(Number(it.height ?? 0)))
      const price     = new Prisma.Decimal(it.unitPrice ?? 0)
      const density   = new Prisma.Decimal(Number(it.fileDensity ?? 1))

      // Yeni formül: subtotal = unitPrice * qty * (width/100) * fileDensity
      const subtotal  = price
        .mul(new Prisma.Decimal(widthInt).div(100))
        .mul(density)
        .mul(qtyInt)

      const slotForDb =
        typeof it.slotIndex === 'number' && Number.isFinite(it.slotIndex)
          ? it.slotIndex
          : null

      // Ortak alanlar — update için
      const lineDataForUpdate: Prisma.OrderItemUpdateInput = {
        qty: qtyInt,
        width: widthInt,
        height: heightInt,
        unitPrice: price,
        fileDensity: density,
        subtotal,
        note: (it.note ?? null) as string | null,
        category: { connect: { id: String(it.categoryId) } },
        variant:  { connect: { id: String(it.variantId) } },

        // ✅ kritik alanlar:
        lineStatus: { set: it.lineStatus ?? 'pending' },
        slotIndex:  { set: slotForDb },
      }

      if (it.id) {
        if (!ownedSet.has(String(it.id))) {
          return NextResponse.json({ error: 'forbidden_item_update' }, { status: 403 })
        }
        ops.push(prisma.orderItem.update({ where: { id: String(it.id) }, data: lineDataForUpdate }))
      } else {
        // create için ayrıca order bağlantısını veriyoruz
        const lineDataForCreate: Prisma.OrderItemCreateInput = {
          qty: qtyInt,
          width: widthInt,
          height: heightInt,
          unitPrice: price,
          fileDensity: density,
          subtotal,
          note: (it.note ?? null) as string | null,
          category: { connect: { id: String(it.categoryId) } },
          variant:  { connect: { id: String(it.variantId) } },
          order: { connect: { id: orderId } },

          // ✅ kritik alanlar:
          lineStatus: it.lineStatus ?? 'pending',
          slotIndex:  slotForDb,
        }
        ops.push(prisma.orderItem.create({ data: lineDataForCreate }))
      }
    }

    // Başlık güncelle (stor/aksesuar satırları dahil)
    const storClean = (storLines ?? []).map(s => s.trim()).filter(Boolean)
    const accClean  = (accessoryLines ?? []).map(s => s.trim()).filter(Boolean)

    const headerPatch: Prisma.OrderUpdateInput = {}
    if (typeof note !== 'undefined')          headerPatch.note = note
    if (typeof status !== 'undefined')        headerPatch.status = status
    if (typeof customerName !== 'undefined')  headerPatch.customerName = customerName.trim()
    if (typeof customerPhone !== 'undefined') headerPatch.customerPhone = customerPhone.trim()
    if (typeof storLines !== 'undefined')     headerPatch.storLines = storClean as unknown as Prisma.InputJsonValue
    if (typeof accessoryLines !== 'undefined')headerPatch.accessoryLines = accClean as unknown as Prisma.InputJsonValue

    // ✅ "YYYY-MM-DD" → Date (UTC 00:00) veya null
    if (typeof deliveryAt !== 'undefined') {
      headerPatch.deliveryAt = deliveryAt
        ? new Date(`${deliveryAt}T00:00:00Z`)
        : null
    }

    // ✅ orderType güncelle
    if (typeof orderType !== 'undefined') {
      headerPatch.orderType = orderType;
    }

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

    // Mevcut indirimi çek ve net toplamı güncelle
    const discountRow = await prisma.order.findUnique({
      where: { id: orderId },
      select: { discount: true },
    })
    const currentDiscount = Number(discountRow?.discount ?? 0)
    const clampedDiscount = Math.max(0, Math.min(currentDiscount, total))
    const netTotal = Math.max(0, total - clampedDiscount)

    await prisma.order.update({
      where: { id: orderId },
      data: {
        total:    new Prisma.Decimal(total),
        discount: new Prisma.Decimal(clampedDiscount),
        netTotal: new Prisma.Decimal(netTotal),
      },
    })

    // Güncel sipariş + ödemeler (ödenen/kalan hesaplı)
    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { category: true, variant: true },
          orderBy: { id: 'asc' },
        },
        extras: true,
        payments: { orderBy: { paidAt: 'asc' } },
      },
    })
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const paidTotal = (updated.payments ?? []).reduce((a, p) => a + Number(p.amount), 0)
    const balance   = Number(updated.netTotal) - paidTotal

    return NextResponse.json({
      ...updated,
      total:    Number(updated.total),
      discount: Number(updated.discount),
      netTotal: Number(updated.netTotal),
      orderType: Number(updated.orderType ?? 0), // ✅ eklendi
      items: updated.items.map(it => ({
        ...it,
        unitPrice:   Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal:    Number(it.subtotal),
        lineStatus:  it.lineStatus,
        slotIndex:   it.slotIndex,
      })),
      payments: updated.payments.map(p => ({ ...p, amount: Number(p.amount) })),
      paidTotal,
      balance,
    })
  } catch (e) {
    console.error('PATCH /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/* ============== DELETE /api/orders/:id ============== */
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
