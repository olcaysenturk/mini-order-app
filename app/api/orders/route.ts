// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'

/* =================== Zod Schemas =================== */
const StatusSchema = z.enum(['pending', 'processing', 'completed', 'cancelled'])

const ItemSchema = z.object({
  categoryId: z.string(),
  variantId: z.string(),
  qty: z.number().int().positive(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(), // UI için tutuluyor (formülde yok)
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1),
  note: z.string().nullable().optional(),
})

const BodySchema = z.object({
  // müşteri bağlama / snapshot
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),

  note: z.string().nullable().optional(),
  status: StatusSchema.default('pending'),
  discount: z.union([z.number(), z.string()]).optional(), // TL

  items: z.array(ItemSchema).min(1),
})

/* =================== GET /api/orders ===================
Query:
  - customerId: string
  - status: pending|processing|completed|cancelled (tek veya virgülle birden çok)
  - q: string (id, not, müşteri adı/telefonu + kalem kategori/varyant/not’ta arar)
  - take: number (default 100, max 200)
*/
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const sp = url.searchParams

    const customerIdParam = sp.get('customerId') || undefined
    const q = (sp.get('q') || '').trim()
    const statusParam = (sp.get('status') || '').trim()
    const valid = new Set(['pending', 'processing', 'completed', 'cancelled'] as const)
    const inList = statusParam
      ? statusParam
          .split(',')
          .map((s) => s.trim())
          .filter((s) => valid.has(s as any))
      : []

    const takeRaw = Number(sp.get('take') || '100')
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 100

    const where: Prisma.OrderWhereInput = {
      tenantId, // <<< çoklu-tenant şart
    }
    if (customerIdParam) where.customerId = customerIdParam
    if (inList.length) where.status = { in: inList as any }

    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        {
          items: {
            some: {
              OR: [
                { note: { contains: q, mode: 'insensitive' } },
                { category: { name: { contains: q, mode: 'insensitive' } } },
                { variant: { name: { contains: q, mode: 'insensitive' } } },
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
            variant: { select: { name: true} },
          },
          orderBy: { id: 'asc' },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    const payload = orders.map((o) => ({
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
      items: o.items.map((it) => ({
        id: it.id,
        qty: it.qty,
        width: it.width,
        height: it.height,
        unitPrice: Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal: Number(it.subtotal),
        note: it.note,
        category: { name: it.category.name },
        variant: { name: it.variant.name },
      })),
    }))

    return NextResponse.json(payload)
  } catch (e) {
    console.error('GET /orders error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/* =================== POST /api/orders ===================
Yeni sipariş oluşturur. (Yeni formül + net toplam)
*/
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    const userId   = (session?.user as any)?.id as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { customerId, customerName, customerPhone, note, status, discount, items } = parsed.data

    // --- Müşteri belirleme (tenant seviyesinde) - transaction DIŞINDA ---
    let linkedCustomerId: string | null = null
    let snapName  = (customerName  || '').trim()
    let snapPhone = (customerPhone || '').trim()

    if (customerId) {
      const c = await prisma.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { id: true, name: true, phone: true },
      })
      if (c) {
        linkedCustomerId = c.id
        if (!snapName)  snapName  = c.name
        if (!snapPhone) snapPhone = c.phone
      }
    } else if (snapPhone) {
      const existing = await prisma.customer.findUnique({
        where: { tenantId_phone: { tenantId, phone: snapPhone } },
        select: { id: true, name: true, phone: true },
      })
      if (existing) {
        linkedCustomerId = existing.id
        if (!snapName) snapName = existing.name
      } else if (snapName) {
        const created = await prisma.customer.create({
          data: { tenantId, name: snapName, phone: snapPhone },
          select: { id: true, name: true, phone: true },
        })
        linkedCustomerId = created.id
      }
    }

    // --- Kalemleri ÖNCE hesapla + toplamlara hazırlan ---
    const prepared = items.map(it => {
      const qty       = Math.max(1, Math.trunc(Number(it.qty)))
      const width     = Math.max(0, Math.trunc(Number(it.width)))
      const height    = Math.max(0, Math.trunc(Number(it.height)))
      const unitPrice = new Prisma.Decimal(it.unitPrice)
      const density   = new Prisma.Decimal(Number(it.fileDensity) || 1)

      // Formül: unitPrice * max(1, (width/100)*density) * qty
      const wmt       = new Prisma.Decimal(width).div(100)
      const meterPart = Prisma.Decimal.max(new Prisma.Decimal(1), wmt.mul(density))
      const subtotal  = unitPrice.mul(meterPart).mul(qty)

      return {
        categoryId: it.categoryId,
        variantId:  it.variantId,
        qty,
        width,
        height,         // UI’da gösterim için saklıyoruz
        unitPrice,
        fileDensity: density,
        subtotal,
        note: it.note ?? null,
      }
    })

    // Güvenlik: tüm categoryId/variantId'ler bu tenant'a ait mi?
    const catIds = Array.from(new Set(prepared.map(p => p.categoryId)))
    const varIds = Array.from(new Set(prepared.map(p => p.variantId)))

    const [catOk, varOk] = await Promise.all([
      prisma.category.findMany({ where: { tenantId, id: { in: catIds } }, select: { id: true } }),
      prisma.variant.findMany({ where: { tenantId, id: { in: varIds } }, select: { id: true } }),
    ])
    if (catOk.length !== catIds.length || varOk.length !== varIds.length) {
      return NextResponse.json({ error: 'forbidden_category_or_variant' }, { status: 403 })
    }

    // Toplam hesapları
    let total = prepared.reduce((acc, p) => acc.add(p.subtotal), new Prisma.Decimal(0))
    const discReq = new Prisma.Decimal(Number(discount ?? 0) || 0)
    const discountClamped = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      Prisma.Decimal.min(discReq, total),
    )
    const net = total.sub(discountClamped)

    // --- TEK SORGU: order + nested items.create ---
    const created = await prisma.order.create({
      data: {
        tenantId,
        createdById: userId ?? null,
        note: note ?? null,
        status,
        customerId: linkedCustomerId,
        customerName:  snapName  || '',
        customerPhone: snapPhone || '',
        total,
        discount: discountClamped,
        netTotal: net,
        items: { create: prepared },
      },
      include: {
        items: {
          include: { category: true, variant: true },
          orderBy: { id: 'asc' },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    // Sayılara cast (UI için)
    const payload = {
      ...created,
      total:    Number(created.total),
      discount: Number(created.discount),
      netTotal: Number(created.netTotal),
      items: created.items.map(it => ({
        ...it,
        unitPrice:   Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal:    Number(it.subtotal),
      })),
    }

    return NextResponse.json(payload, { status: 201 })
  } catch (e) {
    console.error('POST /orders error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
