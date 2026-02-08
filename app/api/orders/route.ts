// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { Prisma, OrderStatus as OrderStatusEnum } from '@prisma/client'
import { z } from 'zod'
import { logOrderAudit } from './orderAudit'
import { sendMail } from '@/app/lib/mailer'

export const runtime = 'nodejs'
const TRY_FORMATTER = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

/* =================== Helpers =================== */
// Satır (OrderItem) durumları
const LineStatusSchema = z.enum(['pending', 'processing', 'completed', 'cancelled'])

// Sipariş (Order) durumları — DB enum’unla uyumlu olmalı
const OrderStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'cancelled',
  'workshop',
  'deleted',
])

const ORDER_STATUS_VALUES = [
  OrderStatusEnum.pending,
  OrderStatusEnum.processing,
  OrderStatusEnum.completed,
  OrderStatusEnum.cancelled,
  OrderStatusEnum.workshop,
  OrderStatusEnum.deleted,
] as const
type OrderStatusLiteral = (typeof ORDER_STATUS_VALUES)[number]

function toOrderStatusEnum(v: string): OrderStatusLiteral | null {
  return ORDER_STATUS_VALUES.includes(v as OrderStatusLiteral) ? (v as OrderStatusLiteral) : null
}

/** "YYYY-MM-DD" → Europe/Istanbul local Date (00:00) */
function parseYMDToLocalDate(ymd?: string | null): Date | null {
  if (!ymd) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const [, y, mo, d] = m
  return new Date(Number(y), Number(mo) - 1, Number(d))
}

/* =================== Zod Schemas =================== */
const ItemSchema = z.object({
  categoryId: z.string(),
  variantId: z.string(),
  qty: z.number().int().positive(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1),
  note: z.string().nullable().optional(),
  slotIndex: z.number().int().min(0).nullable().optional(),
  lineStatus: LineStatusSchema.default('processing').optional(),
})

/**
 * Geriye dönük uyumluluk:
 * - Yeni istemci branchId gönderir.
 * - Eski istemci dealerId gönderiyorsa da kabul edip branchId olarak kullanırız.
 */
const BodySchema = z
  .object({
    branchId: z.string().min(1).optional(),
    dealerId: z.string().min(1).optional(), // legacy
    customerId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    note: z.string().nullable().optional(),
    // Order status — UI defaultu 'processing'
    status: OrderStatusSchema.default('processing'),
    discount: z.union([z.number(), z.string()]).optional(), // TL
    items: z.array(ItemSchema).min(1),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    orderType: z.union([z.literal(0), z.literal(1)]).default(0),
  })
  .refine((d) => !!(d.branchId || d.dealerId), {
    message: 'branchId (veya legacy dealerId) zorunlu',
    path: ['branchId'],
  })

/* =================== GET /api/orders ===================
Query:
  - branchId: string (yeni)
  - dealerId: string (legacy) — branchId yerine de çalışır
  - customerId: string
  - status: pending,processing,completed,cancelled,workshop,deleted (virgüllü)
  - q: string (id, not, müşteri adı/telefonu + kalem kategori/varyant/not’ta arar)
  - take: number (default 100, max 200)
  - includeDeleted=1 → silinenler dahil
  - only=deleted      → sadece silinenler
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

    const branchIdParam = sp.get('branchId') || sp.get('dealerId') || undefined // dealerId → branchId alias
    const customerIdParam = sp.get('customerId') || undefined
    const q = (sp.get('q') || '').trim()
    const statusParam = (sp.get('status') || '').trim()

    // status listesi
    const inListRaw = statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const inList = inListRaw
      .map(toOrderStatusEnum)
      .filter((x): x is OrderStatusLiteral => !!x)

    const includeDeleted =
      sp.get('includeDeleted') === '1' ||
      sp.get('includeDeleted')?.toLowerCase() === 'true'
    const onlyDeleted = sp.get('only') === 'deleted'

    const takeRaw = Number(sp.get('take') || '50')
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 50

    const pageRaw = Number(sp.get('page') || '1')
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const skip = (page - 1) * take

    const orderTypeRaw = sp.get('orderType')
    const orderType = orderTypeRaw ? Number(orderTypeRaw) : undefined

    const orderByParam = sp.get('orderBy') || 'createdAt'
    const orderDirParam = sp.get('orderDir') === 'asc' ? 'asc' : 'desc'

    // AND biriktirerek koşulları kur
    const and: Prisma.OrderWhereInput[] = [{ tenantId }]

    if (orderType !== undefined && !Number.isNaN(orderType)) {
      and.push({ orderType: orderType as any }) // 0 or 1
    }

    if (branchIdParam) and.push({ branchId: branchIdParam })
    if (customerIdParam) and.push({ customerId: customerIdParam })

    if (onlyDeleted) {
      and.push({ status: OrderStatusEnum.deleted })
    } else {
      if (!includeDeleted) and.push({ NOT: { status: OrderStatusEnum.deleted } })
      if (inList.length === 1) {
        and.push({ status: inList[0] })
      } else if (inList.length > 1) {
        and.push({ status: { in: inList } })
      }
    }

    if (q) {
      and.push({
        OR: [
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
        ],
      })
    }

    const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {}

    // Sort mapping
    let orderByArg: Prisma.OrderOrderByWithRelationInput = { createdAt: 'desc' }
    if (orderByParam === 'deliveryDate') {
      orderByArg = { deliveryAt: orderDirParam }
    } else if (orderByParam === 'createdAt') {
      orderByArg = { createdAt: orderDirParam }
    }

    // 1) Toplam sayıyı çek (Pagination meta için)
    const totalCount = await prisma.order.count({ where })

    // 2) Siparişleri çek
    const orders = await prisma.order.findMany({
      where,
      orderBy: orderByArg,
      take,
      skip,
      include: {
        items: {
          include: {
            category: { select: { name: true } },
            variant: { select: { name: true } },
          },
          orderBy: [{ categoryId: 'asc' }, { slotIndex: 'asc' as const }, { id: 'asc' }],
        },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    // if (orders.length === 0) return NextResponse.json([]) // Return empty wrapper instead

    // 3) Ödemeleri grupla
    const orderIds = orders.map((o) => o.id)
    const paymentSums = await prisma.orderPayment.groupBy({
      by: ['orderId'],
      where: { tenantId, orderId: { in: orderIds } },
      _sum: { amount: true },
    })
    const paidMap = new Map<string, number>(
      paymentSums.map((r) => [r.orderId, Number(r._sum.amount ?? 0)])
    )

    // 4) Ek gider (OrderExtra) toplamlarını çek
    const extraSums = await prisma.orderExtra.groupBy({
      by: ['orderId'],
      where: { orderId: { in: orderIds } },
      _sum: { subtotal: true },
    })
    const extraMap = new Map<string, number>(
      extraSums.map((r) => [r.orderId, Number(r._sum.subtotal ?? 0)])
    )

    // 5) Payload
    const data = orders.map((o) => {
      // const itemsSubTotal = o.items.reduce((sum, it) => sum + Number(it.subtotal ?? 0), 0)
      // const extrasSubTotal = Number(extraMap.get(o.id) ?? 0)
      // const subTotal = itemsSubTotal + extrasSubTotal

      const subTotal = o.items.reduce((acc, item) => {
        const existing = Number(item.subtotal ?? 0);
        if (Number.isFinite(existing) && existing > 0) {
          return acc + existing;
        }
        const qtySafe = Math.max(1, Number(item.qty ?? 1));
        const widthSafe = Math.max(0, Number(item.width ?? 0));
        const densitySafe = Number(item.fileDensity ?? 1) || 1;
        const unitSafe = Number(item.unitPrice ?? 0);
        const fallback = unitSafe * ((widthSafe / 100) * densitySafe || 1) * qtySafe;
        return acc + fallback;
      }, 0);


      const discount = Math.max(0, Number((o as any).discount ?? 0))
      const grandTotal = Math.max(0, subTotal - discount)
      const total = Number(o.total ?? subTotal)
      const netTotal = Number((o as any).netTotal ?? grandTotal)
      const paidTotal = Number(paidMap.get(o.id) ?? 0)
      const balance = Math.max(0, netTotal - paidTotal)

      return {
        id: o.id,
        createdAt: o.createdAt,
        deliveryAt: o.deliveryAt ?? null,
        deliveryDate: o.deliveryAt ? o.deliveryAt.toISOString().slice(0, 10) : null,
        note: o.note,
        status: o.status,
        branch: o.branch,
        dealer: o.branch, // legacy alias
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        customer: o.customer,
        total,
        discount,
        netTotal,
        subTotal,
        grandTotal,
        paidTotal,
        totalPaid: paidTotal, // legacy
        balance,
        orderType: o.orderType,
        items: o.items.map((it) => ({
          id: it.id,
          qty: it.qty,
          width: it.width,
          height: it.height,
          unitPrice: Number(it.unitPrice),
          fileDensity: Number(it.fileDensity),
          subtotal: Number(it.subtotal),
          note: it.note,
          slotIndex: it.slotIndex ?? null,
          lineStatus: (it as any).lineStatus ?? 'processing',
          category: { name: it.category.name },
          variant: { name: it.variant.name },
        })),
      }
    })

    return NextResponse.json({
      data,
      meta: {
        total: totalCount,
        page,
        limit: take,
        totalPages: Math.ceil(totalCount / take),
      },
    })
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
    const userId = (session?.user as any)?.id as string | undefined
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

    const {
      branchId: branchIdRaw,
      dealerId: dealerIdRaw, // legacy
      customerId,
      customerName,
      customerPhone,
      note,
      status, // OrderStatusSchema
      discount,
      items,
      deliveryDate,
      orderType,
    } = parsed.data

    const branchIdInput = branchIdRaw ?? dealerIdRaw!

    // ŞUBE doğrulama
    const branch = await prisma.branch.findFirst({
      where: { id: branchIdInput, tenantId, isActive: true },
      select: { id: true, name: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'invalid_branch' }, { status: 400 })
    }

    // Müşteri belirleme
    let linkedCustomerId: string | null = null
    let snapName = (customerName || '').trim()
    let snapPhone = (customerPhone || '').trim()

    if (customerId) {
      const c = await prisma.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { id: true, name: true, phone: true },
      })
      if (c) {
        linkedCustomerId = c.id
        if (!snapName) snapName = c.name
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

    // Kategori & varyant doğrulama
    const catIds = Array.from(new Set(items.map((p) => p.categoryId)))
    const varIds = Array.from(new Set(items.map((p) => p.variantId)))

    const [catRows, varOk] = await Promise.all([
      prisma.category.findMany({
        where: { tenantId, id: { in: catIds } },
        select: { id: true, name: true },
      }),
      prisma.variant.findMany({ where: { tenantId, id: { in: varIds } }, select: { id: true } }),
    ])
    if (varOk.length !== varIds.length || catRows.length !== catIds.length) {
      return NextResponse.json({ error: 'forbidden_category_or_variant' }, { status: 403 })
    }

    const nameByCat = new Map(catRows.map((c) => [c.id, c.name]))
    const isStorCat = (catId: string) =>
      (nameByCat.get(catId) || '').trim().toLocaleUpperCase('tr-TR') === 'STOR PERDE'

    const prepared = items.map((it) => {
      const qty = Math.max(1, Math.trunc(Number(it.qty)))
      const width = Math.max(0, Math.trunc(Number(it.width)))
      const height = Math.max(0, Math.trunc(Number(it.height)))
      const unitPrice = new Prisma.Decimal(it.unitPrice)
      const density = new Prisma.Decimal(Number(it.fileDensity) || 1)

      const wmt = new Prisma.Decimal(Math.max(100, width)).div(100);
      const hmt = new Prisma.Decimal(height).div(100)

      // STOR = m², Diğer = max(1, (en/100)*file)
      const base = isStorCat(it.categoryId)
        ? wmt.mul(hmt) // m²
        : Prisma.Decimal.max(new Prisma.Decimal(1), wmt.mul(density))

      const subtotal = unitPrice.mul(base).mul(qty)

      return {
        categoryId: it.categoryId,
        variantId: it.variantId,
        qty,
        width,
        height,
        unitPrice,
        fileDensity: density,
        subtotal,
        note: it.note ?? null,
        slotIndex: typeof it.slotIndex === 'number' ? it.slotIndex : null,
        lineStatus: (it as any).lineStatus ?? 'processing',
      }
    })

    // Toplamlar
    let total = prepared.reduce((acc, p) => acc.add(p.subtotal), new Prisma.Decimal(0))
    const discReq = new Prisma.Decimal(Number(discount ?? 0) || 0)
    const discountClamped = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      Prisma.Decimal.min(discReq, total),
    )
    const net = total.sub(discountClamped)

    // Create
    const existingOrderCount = userId
      ? await prisma.order.count({
          where: { createdById: userId },
        })
      : null

    const created = await prisma.order.create({
      data: {
        tenantId,
        branchId: branch.id,
        createdById: userId ?? null,
        note: note ?? null,
      status, // OrderStatus enum — DB’de mevcut olmalı
        customerId: linkedCustomerId,
        customerName: snapName || '',
        customerPhone: snapPhone || '',
        total,
        discount: discountClamped,
        netTotal: net,
        deliveryAt: parseYMDToLocalDate(deliveryDate) ?? undefined,
        orderType,
        items: { create: prepared },
      },
      include: {
        items: {
          include: { category: true, variant: true },
          orderBy: [{ categoryId: 'asc' }, { slotIndex: 'asc' as const }, { id: 'asc' }],
        },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    await logOrderAudit({
      orderId: created.id,
      tenantId,
      userId: userId ?? null,
      action: 'order.create',
      payload: parsed.data,
    })

    const netNumber = Number(created.netTotal)
    const payload = {
      ...created,
      branch: created.branch,
      dealer: created.branch, // legacy alias
      total: Number(created.total),
      discount: Number(created.discount),
      netTotal: netNumber,
      paidTotal: 0,
      totalPaid: 0,
      balance: netNumber,
      deliveryDate: created.deliveryAt ? created.deliveryAt.toISOString().slice(0, 10) : null,
      orderType: created.orderType,
      items: created.items.map((it) => ({
        id: it.id,
        categoryId: it.categoryId,
        variantId: it.variantId,
        qty: it.qty,
        width: it.width,
        height: it.height,
        unitPrice: Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal: Number(it.subtotal),
        note: it.note,
        slotIndex: it.slotIndex ?? null,
        lineStatus: (it as any).lineStatus ?? 'processing',
        category: { name: it.category.name },
        variant: { name: it.variant.name },
      })),
    }

    const creatorEmail = (session?.user as any)?.email as string | undefined
    if (creatorEmail && userId && existingOrderCount === 0) {
      const orderUrl = APP_URL ? `${APP_URL}/dashboard/orders/${created.id}` : null
      const customerLabel = payload.customerName || 'Müşteri'
      const totalText = TRY_FORMATTER.format(netNumber)
      const subject = `Yeni sipariş oluşturuldu • ${customerLabel}`
      const lines = [
        `<p>Merhaba ${session?.user?.name ?? ''},</p>`,
        `<p><strong>${customerLabel}</strong> için yeni bir sipariş oluşturdunuz.</p>`,
        `<p><b>Sipariş No:</b> ${created.id}<br/><b>Toplam (Net):</b> ${totalText}${
          payload.branch?.name ? `<br/><b>Şube:</b> ${payload.branch.name}` : ''
        }</p>`,
        orderUrl
          ? `<p><a href="${orderUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;border-radius:10px;text-decoration:none">Siparişi görüntüle</a></p>`
          : '',
        `<p>İyi çalışmalar.</p>`,
      ].join('')
      const text = [
        `Merhaba ${session?.user?.name ?? ''}`,
        `Yeni sipariş: ${created.id}`,
        `Müşteri: ${customerLabel}`,
        `Toplam: ${totalText}`,
        orderUrl ? `Sipariş bağlantısı: ${orderUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      try {
        await sendMail({
          to: creatorEmail,
          subject,
          html: lines,
          text,
        })
      } catch (mailErr) {
        console.error('POST /orders mail error:', mailErr)
      }
    }

    return NextResponse.json(payload, { status: 201 })
  } catch (e) {
    console.error('POST /orders error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
