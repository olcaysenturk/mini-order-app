// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'

const StatusSchema = z.enum(['pending','processing','completed','cancelled'])

const ItemSchema = z.object({
  categoryId: z.string(),
  variantId: z.string(),
  qty: z.number().int().positive(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(), // UI'da dursun (formülde yok)
  unitPrice: z.union([z.number(), z.string()]).transform(v => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1),
  note: z.string().nullable().optional(),
})

const BodySchema = z.object({
  // müşteri bağlama
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),

  note: z.string().nullable().optional(),
  status: StatusSchema.default('pending'),
  discount: z.union([z.number(), z.string()]).optional(), // TL

  items: z.array(ItemSchema).min(1),
})

/** LISTE: GET /api/orders
 * Query:
 *  - customerId: string
 *  - status: pending|processing|completed|cancelled (tek ya da virgülle birden çok)
 *  - q: string  (id, not, müşteri adı/telefonu + kalem kategori/varyant/not içinde arar)
 *  - take: number (default 100, max 200)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sp = url.searchParams

    const customerId = sp.get('customerId') || undefined
    const q = (sp.get('q') || '').trim()
    const statusParam = (sp.get('status') || '').trim()
    const valid = new Set(['pending','processing','completed','cancelled'] as const)
    const inList = statusParam
      ? statusParam.split(',').map(s => s.trim()).filter(s => valid.has(s as any))
      : []

    const takeRaw = Number(sp.get('take') || '100')
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 100

    const where: Prisma.OrderWhereInput = {}

    if (customerId) where.customerId = customerId
    if (inList.length) where.status = { in: inList as any }

    if (q) {
      where.OR = [
        { id: { contains: q } },
        { note: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
        {
          items: {
            some: {
              OR: [
                { note: { contains: q } },
                { category: { name: { contains: q } } },
                { variant:  { name: { contains: q } } },
              ],
            },
          },
        },
      ]
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        items: {
          include: {
            category: { select: { name: true } },
            variant:  { select: { name: true } },
          },
          orderBy: { id: 'asc' },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    const payload = orders.map(o => ({
      id: o.id,
      createdAt: o.createdAt,
      note: o.note,
      status: o.status,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customer: o.customer,
      total: Number(o.total),
      discount: Number((o as any).discount ?? 0),
      netTotal: Number((o as any).netTotal ?? o.total),
      items: o.items.map(it => ({
        id: it.id,
        qty: it.qty,
        width: it.width,
        height: it.height,
        unitPrice: Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal: Number(it.subtotal),
        note: it.note,
        category: { name: it.category.name },
        variant:  { name: it.variant.name },
      })),
    }))

    return NextResponse.json(payload)
  } catch (e) {
    console.error('GET /orders error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** OLUSTUR: POST /api/orders  — yeni formülle hesaplar */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { customerId, customerName, customerPhone, note, status, discount, items } = parsed.data

    // --- Müşteriyi belirle ---
    let linkedCustomerId: string | null = null
    let snapName = (customerName || '').trim()
    let snapPhone = (customerPhone || '').trim()

    if (customerId) {
      const c = await prisma.customer.findUnique({ where: { id: customerId } })
      if (c) {
        linkedCustomerId = c.id
        if (!snapName) snapName = c.name
        if (!snapPhone) snapPhone = c.phone
      }
    } else if (snapPhone) {
      const existing = await prisma.customer.findUnique({ where: { phone: snapPhone } })
      if (existing) {
        linkedCustomerId = existing.id
        if (!snapName) snapName = existing.name
      } else if (snapName) {
        const created = await prisma.customer.create({
          data: { name: snapName, phone: snapPhone },
          select: { id: true, name: true, phone: true },
        })
        linkedCustomerId = created.id
      }
    }

    // --- Siparişi ve kalemleri tek seferde oluştur ---
    const created = await prisma.$transaction(async (tx) => {
      // 1) Order oluştur
      const order = await tx.order.create({
        data: {
          note: note ?? null,
          status,
          customerId: linkedCustomerId,
          customerName: snapName || '',
          customerPhone: snapPhone || '',
          total:    new Prisma.Decimal(0),
          discount: new Prisma.Decimal(Number(discount ?? 0) || 0),
          netTotal: new Prisma.Decimal(0),
        },
        select: { id: true }
      })

      // 2) Kalemleri oluştur + brüt toplam
      let total = new Prisma.Decimal(0)

      for (const it of items) {
        const qty       = Math.max(1, Math.trunc(Number(it.qty)))
        const width     = Math.max(0, Math.trunc(Number(it.width)))
        const unitPrice = new Prisma.Decimal(it.unitPrice)
        const density   = new Prisma.Decimal(Number(it.fileDensity) || 1)

        // === YENİ FORMÜL ===
        // lineTotal = unitPrice * ((width/100) * density || 1) * qty
        const wmt       = new Prisma.Decimal(width).div(100) // en/100 (metre)
        const meterPart = Prisma.Decimal.max(new Prisma.Decimal(1), wmt.mul(density))
        const lineTotal = unitPrice.mul(meterPart).mul(qty)

        await tx.orderItem.create({
          data: {
            orderId:    order.id,
            categoryId: it.categoryId,
            variantId:  it.variantId,
            qty,
            width,
            height:     Math.max(0, Math.trunc(Number(it.height))), // UI için tutuluyor
            unitPrice,
            fileDensity: density,
            subtotal:   lineTotal,
            note: it.note ?? null,
          }
        })

        total = total.add(lineTotal)
      }

      // 3) Net toplam (iskonto uygulanır; 0..total aralığına clamp)
      const discReq = new Prisma.Decimal(Number(discount ?? 0) || 0)
      const disc = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        Prisma.Decimal.min(discReq, total)
      )
      const net = total.sub(disc)

      await tx.order.update({
        where: { id: order.id },
        data: {
          total,
          discount: disc,
          netTotal: net,
        }
      })

      // 4) Siparişi detaylı döndür
      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: { category: true, variant: true },
            orderBy: { id: 'asc' },
          },
          customer: { select: { id: true, name: true, phone: true } },
        }
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('POST /orders error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
