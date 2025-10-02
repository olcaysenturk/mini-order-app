// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

/** ---------- Ortak tipler / şemalar ---------- */
const StatusSchema = z.enum(['pending','processing','completed','cancelled'])

const LinesSchema = z
  .array(z.string().transform(s => s.trim()))
  .max(6)
  .optional()

const PatchItemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  variantId: z.string(),
  qty: z.number().int().positive(),
  width: z.number().int().nonnegative(),   // cm
  height: z.number().int().nonnegative(),  // cm
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1), // m² ile çarpılacak
  note: z.string().nullable().optional(),
  _action: z.enum(['upsert','delete']).optional(), // default: upsert
})

const PatchBodySchema = z.object({
  note: z.string().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  status: StatusSchema.optional(),
  items: z.array(PatchItemSchema).optional(),

  // NEW alanlar:
  storLines: LinesSchema,
  accessoryLines: LinesSchema,
})

type Ctx = { params: Promise<{ id: string }> }

/** TEK SİPARİŞ: GET /api/orders/:id  (seq dahil) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params

    // seq hesaplama (oluşturulma tarihine göre, en eski 1, en yeni N olacak şekilde)
    const all = await prisma.order.findMany({
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' }, // artan; index+1 = seq
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
      },
    })
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ...order, seq })
  } catch (e) {
    console.error('GET /orders/:id error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** GÜNCELLE: PATCH /api/orders/:id */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const json = await req.json()
    const parsed = PatchBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const {
      note, customerName, customerPhone, status, items,
      storLines, accessoryLines,
    } = parsed.data

    const storClean = (storLines ?? []).map(s => s.trim()).filter(Boolean)
    const accClean  = (accessoryLines ?? []).map(s => s.trim()).filter(Boolean)

    const updated = await prisma.$transaction(async (tx) => {
      // 1) Kalem işlemleri (varsa)
      if (Array.isArray(items) && items.length > 0) {
        // 1a) Silinecekler
        const toDeleteIds = items
          .filter(i => (i._action ?? 'upsert') === 'delete' && i.id)
          .map(i => String(i.id))

        if (toDeleteIds.length) {
          await tx.orderItem.deleteMany({
            where: { orderId: id, id: { in: toDeleteIds } },
          })
        }

        // 1b) Upsert edilecekler (m² * fileDensity * unitPrice hesabı ile)
        const upserts = items.filter(i => (i._action ?? 'upsert') === 'upsert')
        for (const it of upserts) {
          const qty = Math.max(1, Math.trunc(Number(it.qty ?? 0)))
          const width = Math.max(0, Math.trunc(Number(it.width ?? 0)))
          const height = Math.max(0, Math.trunc(Number(it.height ?? 0)))
          const unitPrice = new Prisma.Decimal(it.unitPrice ?? 0)
          const density = new Prisma.Decimal(Number(it.fileDensity ?? 1))
          const qDec = new Prisma.Decimal(qty)
          const wDec = new Prisma.Decimal(width)
          const hDec = new Prisma.Decimal(height)
          const m2 = qDec.mul(wDec).mul(hDec).div(10000) // cm -> m²
          const subtotal = unitPrice.mul(m2).mul(density)
          const lineNote = (it.note ?? null) as string | null

          if (it.id) {
            // Güvenlik: bu kalem gerçekten bu siparişe mi ait?
            const owned = await tx.orderItem.findUnique({
              where: { id: String(it.id) },
              select: { orderId: true },
            })
            if (!owned || owned.orderId !== id) {
              throw new Error('forbidden_item_update') // başka order'a ait item
            }

            await tx.orderItem.update({
              where: { id: String(it.id) },
              data: {
                qty, width, height,
                unitPrice, subtotal,
                fileDensity: density,
                note: lineNote,
                category: { connect: { id: String(it.categoryId) } },
                variant:  { connect: { id: String(it.variantId) } },
              },
            })
          } else {
            await tx.orderItem.create({
              data: {
                order:    { connect: { id } },
                category: { connect: { id: String(it.categoryId) } },
                variant:  { connect: { id: String(it.variantId) } },
                qty, width, height,
                unitPrice, subtotal,
                fileDensity: density,
                note: lineNote,
              },
            })
          }
        }
      }

      // 2) Toplamı yeniden hesapla (sadece item'lardan)
      const freshItems = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { subtotal: true },
      })
      let total = new Prisma.Decimal(0)
      for (const fi of freshItems) {
        total = total.add(new Prisma.Decimal(fi.subtotal))
      }

      // 3) Sipariş başlığını güncelle
      const data: Prisma.OrderUpdateInput = { total }

      if (typeof note !== 'undefined') data.note = note
      if (typeof status !== 'undefined') data.status = status
      if (typeof customerName !== 'undefined') data.customerName = customerName.trim()
      if (typeof customerPhone !== 'undefined') data.customerPhone = customerPhone.trim()

      // NEW: STOR / AKSESUAR alanlarını güncelle
      if (typeof storLines !== 'undefined') {
        data.storLines = storClean as unknown as Prisma.InputJsonValue
      }
      if (typeof accessoryLines !== 'undefined') {
        data.accessoryLines = accClean as unknown as Prisma.InputJsonValue
      }

      await tx.order.update({
        where: { id },
        data,
      })

      // 4) Güncel siparişi detaylı döndür
      return tx.order.findUnique({
        where: { id },
        include: {
          items: {
            include: { category: true, variant: true },
            orderBy: { id: 'asc' },
          },
        },
      })
    })

    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('PATCH /orders/:id error:', e)
    const code = e instanceof Error ? e.message : String(e)
    if (code === 'forbidden_item_update') {
      return NextResponse.json({ error: 'forbidden_item_update' }, { status: 403 })
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** SİL: DELETE /api/orders/:id */
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
