// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '../../auth/[...nextauth]/options'
import { logOrderAudit } from '../orderAudit'

/* ================= Zod Schemas ================ */
// Order için: deleted & workshop dahil
const OrderStatusSchema = z.enum(['pending', 'processing', 'completed', 'cancelled', 'workshop', 'deleted'])
// OrderItem (line) için: deleted/workshop yok
const LineStatusSchema  = z.enum(['pending', 'processing', 'completed', 'cancelled'])

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

  // ⬇️ line statüsü OrderItem enum’u ile uyumlu
  lineStatus: LineStatusSchema.default('processing'),
  slotIndex: z.number().int().nullable().optional(),

  _action: z.enum(['upsert', 'delete']).optional(), // default: upsert
})

const PatchBodySchema = z.object({
  note: z.string().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  // ⬇️ Order statüsü (deleted/workshop dahil)
  status: OrderStatusSchema.optional(),
  items: z.array(PatchItemSchema).optional(),
  storLines: LinesSchema,
  accessoryLines: LinesSchema,
  deliveryAt: YmdSchema,
  discount: z.union([z.number(), z.string()]).optional(),

  // ✅ sadece orderType eklendi (0: Yeni Sipariş, 1: Fiyat Teklifi)
  orderType: z.union([z.literal(0), z.literal(1)]).optional(),

  // ✅ soft-deleted siparişi geri alma desteği
  restore: z.boolean().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type SessionCtx = {
  userId: string
  userRole: string
  tenantId: string | null
  tenantRole: string | null
  isSuperAdmin: boolean
}

async function requireSessionContext(): Promise<SessionCtx> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) {
    throw new ApiError('unauthorized', 401)
  }

  const userRole = (session?.user as any)?.role as string | undefined
  const tenantId = ((session as any)?.tenantId ?? null) as string | null
  const tenantRole = ((session as any)?.tenantRole ?? null) as string | null
  const isSuperAdmin = userRole === 'SUPERADMIN'

  if (!isSuperAdmin && !tenantId) {
    throw new ApiError('tenant_not_selected', 400)
  }

  return { userId, userRole: userRole ?? 'STAFF', tenantId, tenantRole, isSuperAdmin }
}

function canManageOrders(ctx: SessionCtx): boolean {
  if (ctx.isSuperAdmin) return true
  return ctx.tenantRole === 'OWNER' || ctx.tenantRole === 'ADMIN'
}

/* =============== GET /api/orders/:id ================= */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const sessionCtx = await requireSessionContext()
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
        audits: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    if (!sessionCtx.isSuperAdmin && sessionCtx.tenantId !== order.tenantId) {
      throw new ApiError('forbidden', 403)
    }

    const paidTotal = (order.payments ?? []).reduce((a, p) => a + Number(p.amount), 0)
    const balance   = Number(order.netTotal) - paidTotal

    return NextResponse.json({
      ...order,
      seq,
      total:    Number(order.total),
      discount: Number(order.discount),
      netTotal: Number(order.netTotal),
      orderType: Number(order.orderType ?? 0),
      items: order.items.map(it => ({
        ...it,
        unitPrice:   Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal:    Number(it.subtotal),
        lineStatus:  it.lineStatus,
        slotIndex:   it.slotIndex,
      })),
      payments: order.payments.map(p => ({
        ...p,
        amount: Number(p.amount),
      })),
      audits: (order.audits ?? []).map(audit => ({
        id: audit.id,
        action: audit.action,
        createdAt: audit.createdAt.toISOString(),
        payload: audit.payload,
        user: audit.user
          ? {
              id: audit.user.id,
              name: audit.user.name ?? null,
              email: audit.user.email ?? null,
            }
          : null,
      })),
      paidTotal,
      balance,
    })
  } catch (e: any) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('GET /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/* ============== PATCH /api/orders/:id ================= */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const sessionCtx = await requireSessionContext()
    const { id: orderId } = await ctx.params
    const existingMeta = await prisma.order.findUnique({
      where: { id: orderId },
      select: { tenantId: true, status: true },
    })
    if (!existingMeta) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (!sessionCtx.isSuperAdmin && sessionCtx.tenantId !== existingMeta.tenantId) {
      throw new ApiError('forbidden', 403)
    }
    const tenantId = existingMeta.tenantId

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
      deliveryAt, // "YYYY-MM-DD" | null
      orderType,
      restore,
      discount: discountInput,
    } = parsed.data

    // ⬇️ Geri alma isteği (soft-deleted → aktif)
    if (restore) {
      if (!canManageOrders(sessionCtx)) {
        throw new ApiError('forbidden', 403)
      }
      const newStatus = status && status !== 'deleted' ? status : 'pending'
      await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus, deletedAt: null },
      })
      await logOrderAudit({
        orderId,
        tenantId,
        userId: sessionCtx.userId,
        action: 'order.restore',
        payload: { previousStatus: existingMeta.status, newStatus },
      })
      return NextResponse.json({ ok: true, status: newStatus })
    }

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

      // (Basit formül) subtotal = unitPrice * qty * (width/100) * fileDensity
      // Not: Eğer STOR/diğer ayrımı istiyorsan burada kategori adına göre
      // m² veya file yoğunluğu mantığını uygulayabilirsin (POST'takiyle aynı).
      const subtotal  = price
        .mul(new Prisma.Decimal(widthInt).div(100))
        .mul(density)
        .mul(qtyInt)

      const slotForDb =
        typeof it.slotIndex === 'number' && Number.isFinite(it.slotIndex)
          ? it.slotIndex
          : null

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

        lineStatus: { set: it.lineStatus ?? 'processing' },
        slotIndex:  { set: slotForDb },
      }

      if (it.id) {
        if (!ownedSet.has(String(it.id))) {
          return NextResponse.json({ error: 'forbidden_item_update' }, { status: 403 })
        }
        ops.push(prisma.orderItem.update({ where: { id: String(it.id) }, data: lineDataForUpdate }))
      } else {
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

          lineStatus: it.lineStatus ?? 'processing',
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

    // "YYYY-MM-DD" → Date (UTC 00:00) veya null
    if (typeof deliveryAt !== 'undefined') {
      headerPatch.deliveryAt = deliveryAt
        ? new Date(`${deliveryAt}T00:00:00Z`)
        : null
    }

    if (typeof orderType !== 'undefined') {
      headerPatch.orderType = orderType
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
    let baseDiscount = Number(discountRow?.discount ?? 0)
    if (typeof discountInput !== 'undefined') {
      const parsed =
        typeof discountInput === 'number'
          ? discountInput
          : parseFloat(String(discountInput).replace(',', '.'))
      baseDiscount = Number.isFinite(parsed) ? parsed : 0
    }
    const clampedDiscount = Math.max(0, Math.min(baseDiscount, total))
    const netTotal = Math.max(0, total - clampedDiscount)

    await prisma.order.update({
      where: { id: orderId },
      data: {
        total:    new Prisma.Decimal(total),
        discount: new Prisma.Decimal(clampedDiscount),
        netTotal: new Prisma.Decimal(netTotal),
      },
    })

    // Güncel sipariş + ödemeler
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

    await logOrderAudit({
      orderId,
      tenantId,
      userId: sessionCtx.userId,
      action: 'order.update',
      payload: parsed.data,
    })

    return NextResponse.json({
      ...updated,
      total:    Number(updated.total),
      discount: Number(updated.discount),
      netTotal: Number(updated.netTotal),
      orderType: Number(updated.orderType ?? 0),
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
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('PATCH /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/* ============== DELETE /api/orders/:id ============== */
// 🔁 SOFT DELETE: status='deleted', deletedAt=now()
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const sessionCtx = await requireSessionContext()
    const { id } = await ctx.params

    const orderMeta = await prisma.order.findUnique({
      where: { id },
      select: { tenantId: true, status: true },
    })
    if (!orderMeta) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (!sessionCtx.isSuperAdmin && sessionCtx.tenantId !== orderMeta.tenantId) {
      throw new ApiError('forbidden', 403)
    }
    if (!canManageOrders(sessionCtx)) {
      throw new ApiError('forbidden', 403)
    }

    await prisma.order.update({
      where: { id },
      data: { status: 'deleted', deletedAt: new Date() },
    })

    await logOrderAudit({
      orderId: id,
      tenantId: orderMeta.tenantId,
      userId: sessionCtx.userId,
      action: 'order.delete',
      payload: { previousStatus: orderMeta.status },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('DELETE /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
