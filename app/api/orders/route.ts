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
  height: z.number().int().nonnegative(), // UI için tutuluyor
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1),
  note: z.string().nullable().optional(),
  // ✅ kutucuk/sıra bilgisi (STOR/AKSESUAR gibi kutusuz alanlarda null olabilir)
  slotIndex: z.number().int().min(0).nullable().optional(),
  // ✅ satır durumu
  lineStatus: StatusSchema.default('pending').optional(),
})

/**
 * Geriye dönük uyumluluk:
 * - Yeni istemci branchId gönderir.
 * - Eski istemci dealerId gönderiyorsa da kabul edip branchId olarak kullanırız.
 */
const BodySchema = z.object({
  branchId: z.string().min(1).optional(),
  dealerId: z.string().min(1).optional(), // legacy
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  note: z.string().nullable().optional(),
  status: StatusSchema.default('pending'),
  discount: z.union([z.number(), z.string()]).optional(), // TL
  items: z.array(ItemSchema).min(1),
}).refine((d) => !!(d.branchId || d.dealerId), {
  message: 'branchId (veya legacy dealerId) zorunlu',
  path: ['branchId'],
})

/* =================== GET /api/orders ===================
Query:
  - branchId: string (yeni)
  - dealerId: string (legacy) — branchId yerine de çalışır
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

    const branchIdParam = sp.get('branchId') || sp.get('dealerId') || undefined // dealerId → branchId alias
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

    const where: Prisma.OrderWhereInput = { tenantId }
    if (branchIdParam) (where as any).branchId = branchIdParam
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

    // 1) Siparişleri çek
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        items: {
          include: {
            category: { select: { name: true } },
            variant: { select: { name: true } },
          },
          // ✅ kutulu alanlarda sıralama: kategori → slotIndex (null last) → id
          orderBy: [{ categoryId: 'asc' }, { slotIndex: 'asc' as const }, { id: 'asc' }],
        },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } }, // ✅ doğru relation
      },
    })

    if (orders.length === 0) {
      return NextResponse.json([])
    }

    // 2) Bu listede yer alan siparişler için toplu ödeme toplamları (performanslı)
    const orderIds = orders.map(o => o.id)

    const paymentSums = await prisma.orderPayment.groupBy({
      by: ['orderId'],
      where: {
        tenantId,
        orderId: { in: orderIds },
        // (İhtiyaç varsa: status=CONFIRMED, deletedAt:null vs.)
      },
      _sum: { amount: true },
    })

    const paidMap = new Map<string, number>(
      paymentSums.map(row => [row.orderId, Number(row._sum.amount ?? 0)])
    )

    // 3) UI payload (paidTotal & balance ekli; totalPaid alias’ı dahil)
    const payload = orders.map((o) => {
      const total = Number(o.total)
      const discount = Number((o as any).discount ?? 0)
      const netTotal = Number((o as any).netTotal ?? total)
      const paidTotal = Number(paidMap.get(o.id) ?? 0)
      const balance = Math.max(0, netTotal - paidTotal)

      return {
        id: o.id,
        createdAt: o.createdAt,
        note: o.note,
        status: o.status,
        branch: o.branch,     // ✅ yeni alan
        dealer: o.branch,     // 🔁 legacy alias (eski UI için)
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        customer: o.customer,
        total,
        discount,
        netTotal,
        paidTotal,            // ✅ FE tarafından kullanılan asıl alan
        totalPaid: paidTotal, // ✅ legacy alias
        balance,              // ✅ borç
        items: o.items.map((it) => ({
          id: it.id,
          qty: it.qty,
          width: it.width,
          height: it.height,
          unitPrice: Number(it.unitPrice),
          fileDensity: Number(it.fileDensity),
          subtotal: Number(it.subtotal),
          note: it.note,
          slotIndex: it.slotIndex ?? null,                 // ✅
          lineStatus: (it as any).lineStatus ?? 'pending', // ✅
          category: { name: it.category.name },
          variant: { name: it.variant.name },
        })),
      }
    })

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

    const {
      branchId: branchIdRaw,
      dealerId: dealerIdRaw, // legacy
      customerId,
      customerName,
      customerPhone,
      note,
      status,
      discount,
      items,
    } = parsed.data

    // ✅ Tek giriş değişkeni: branchIdInput
    const branchIdInput = branchIdRaw ?? dealerIdRaw!

    // --- ŞUBE doğrulama (Branch tablosu) ---
    const branch = await prisma.branch.findFirst({
      where: { id: branchIdInput, tenantId, isActive: true },
      select: { id: true, name: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'invalid_branch' }, { status: 400 })
    }

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

    // --- Kalemleri hazırla (formül: unitPrice * max(1, (width/100)*density) * qty ) ---
    const prepared = items.map(it => {
      const qty       = Math.max(1, Math.trunc(Number(it.qty)))
      const width     = Math.max(0, Math.trunc(Number(it.width)))
      const height    = Math.max(0, Math.trunc(Number(it.height)))
      const unitPrice = new Prisma.Decimal(it.unitPrice)
      const density   = new Prisma.Decimal(Number(it.fileDensity) || 1)

      const wmt       = new Prisma.Decimal(width).div(100)
      const meterPart = Prisma.Decimal.max(new Prisma.Decimal(1), wmt.mul(density))
      const subtotal  = unitPrice.mul(meterPart).mul(qty)

      return {
        categoryId: it.categoryId,
        variantId:  it.variantId,
        qty,
        width,
        height,
        unitPrice,
        fileDensity: density,
        subtotal,
        note: it.note ?? null,
        slotIndex: typeof it.slotIndex === 'number' ? it.slotIndex : null,      // ✅
        lineStatus: (it as any).lineStatus ?? 'pending',                         // ✅
      }
    })

    // Güvenlik: ilgili tenant'a ait kategori & varyantlar mı?
    const catIds = Array.from(new Set(prepared.map(p => p.categoryId)))
    const varIds = Array.from(new Set(prepared.map(p => p.variantId)))

    const [catOk, varOk] = await Promise.all([
      prisma.category.findMany({ where: { tenantId, id: { in: catIds } }, select: { id: true } }),
      prisma.variant.findMany({ where: { tenantId, id: { in: varIds } }, select: { id: true } }),
    ])
    if (catOk.length !== catIds.length || varOk.length !== varIds.length) {
      return NextResponse.json({ error: 'forbidden_category_or_variant' }, { status: 403 })
    }

    // Toplamlar
    let total = prepared.reduce((acc, p) => acc.add(p.subtotal), new Prisma.Decimal(0))
    const discReq = new Prisma.Decimal(Number(discount ?? 0) || 0)
    const discountClamped = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      Prisma.Decimal.min(discReq, total),
    )
    const net = total.sub(discountClamped)

    // --- Create (order + nested items) ---
    const created = await prisma.order.create({
      data: {
        tenantId,
        branchId: branch.id,                 // ✅ artık branchId
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
          orderBy: [{ categoryId: 'asc' }, { slotIndex: 'asc' as const }, { id: 'asc' }],
        },
        customer: { select: { id: true, name: true, phone: true } },
        branch:  { select: { id: true, name: true } }, // ✅ doğru relation
      },
    })

    // Sayılara cast (UI için) + legacy alias + ilk ödeme özetleri
    const netNumber = Number(created.netTotal)
    const payload = {
      ...created,
      branch: created.branch,
      dealer: created.branch, // legacy alias
      total:    Number(created.total),
      discount: Number(created.discount),
      netTotal: netNumber,
      paidTotal: 0,     // ✅ yeni sipariş için başlangıç
      totalPaid: 0,     // ✅ legacy alias
      balance:   netNumber,
      items: created.items.map(it => ({
        id: it.id,
        categoryId: it.categoryId,
        variantId: it.variantId,
        qty: it.qty,
        width: it.width,
        height: it.height,
        unitPrice:   Number(it.unitPrice),
        fileDensity: Number(it.fileDensity),
        subtotal:    Number(it.subtotal),
        note: it.note,
        slotIndex: it.slotIndex ?? null,                 // ✅
        lineStatus: (it as any).lineStatus ?? 'processing', // ✅
        category: { name: it.category.name },
        variant: { name: it.variant.name },
      })),
    }

    return NextResponse.json(payload, { status: 201 })
  } catch (e) {
    console.error('POST /orders error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
