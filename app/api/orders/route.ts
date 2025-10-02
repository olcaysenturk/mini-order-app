import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma, OrderStatus } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'

// ---- Zod şemaları
const StatusSchema = z.enum(['pending','processing','completed','cancelled'])
const LinesSchema = z
  .array(z.string().transform(s => s.trim()))
  .max(6)
  .optional()

const ItemSchema = z.object({
  categoryId: z.string().min(1),
  variantId: z.string().min(1),
  qty: z.number().int().positive(),
  width: z.number().int().nonnegative(),   // cm
  height: z.number().int().nonnegative(),  // cm
  unitPrice: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) && n >= 0 ? n : 0
  }),
  fileDensity: z.number().positive().default(1), // NEW
  note: z.string().nullable().optional(),
})

const BodySchema = z.object({
  note: z.string().optional(),
  status: StatusSchema.optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(ItemSchema).min(1),

  // NEW:
  storLines: LinesSchema,
  accessoryLines: LinesSchema,
})

// ================== GET: listeleme ==================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawStatus = searchParams.get('status')
    const from = searchParams.get('from') // YYYY-MM-DD
    const to   = searchParams.get('to')   // YYYY-MM-DD
    const q    = searchParams.get('q')

    const s = rawStatus?.toLowerCase()
    const statusStr = s && StatusSchema.safeParse(s).success ? (s as z.infer<typeof StatusSchema>) : undefined
    const statusEnum = statusStr as OrderStatus | undefined

    const createdAt: Prisma.OrderWhereInput['createdAt'] = {}
    if (from) createdAt.gte = new Date(from + 'T00:00:00')
    if (to)   createdAt.lte = new Date(to   + 'T23:59:59')

    const textFilter: Prisma.OrderWhereInput[] = q
      ? [
          { customerName: { contains: q } },
          { customerPhone: { contains: q } },
        ]
      : []

    const where: Prisma.OrderWhereInput = {
      ...(statusEnum ? { status: statusEnum } : {}),
      ...(from || to ? { createdAt } : {}),
      ...(q ? { OR: textFilter } : {}),
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { category: true, variant: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders)
  } catch (e) {
    console.error('GET /orders error', e)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
}

// ================== POST: oluşturma ==================
export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const {
      note, items, customerName, customerPhone, status,
      storLines = [], accessoryLines = [],
    } = parsed.data

    const statusEnum: OrderStatus = (status as OrderStatus | undefined) ?? OrderStatus.pending

    // Satırları temizle (boşları ayıkla)
    const storClean = (storLines || []).map(s => s.trim()).filter(Boolean)
    const accClean  = (accessoryLines || []).map(s => s.trim()).filter(Boolean)

    // Toplam tutar
    let total = new Prisma.Decimal(0)

    // Hazırlık: Decimal ile m² * fileDensity * unitPrice
    const prepared = items.map(i => {
      const unitPrice   = new Prisma.Decimal(i.unitPrice)      // para
      const qtyDec      = new Prisma.Decimal(i.qty)            // adet
      const widthDec    = new Prisma.Decimal(i.width)          // cm
      const heightDec   = new Prisma.Decimal(i.height)         // cm
      const densityDec  = new Prisma.Decimal(i.fileDensity)    // file sıklığı

      // m² = (qty * width(cm) * height(cm)) / 10000
      const m2 = qtyDec.mul(widthDec).mul(heightDec).div(10000)

      // subtotal = unitPrice * m² * fileDensity
      const subtotal = unitPrice.mul(m2).mul(densityDec)

      total = total.add(subtotal)

      return {
        categoryId: i.categoryId,
        variantId: i.variantId,
        qty: i.qty,
        width: i.width,
        height: i.height,
        unitPrice,                 // Decimal
        fileDensity: densityDec,   // Decimal
        subtotal,                  // Decimal
        note: i.note ?? null,
      }
    })

    const order = await prisma.order.create({
      data: {
        note: note?.trim() || undefined,
        status: statusEnum,
        customerName: (customerName ?? '').trim(),
        customerPhone: (customerPhone ?? '').trim(),
        total,
        storLines:      storClean as unknown as Prisma.InputJsonValue,   // NEW
        accessoryLines: accClean  as unknown as Prisma.InputJsonValue,   // NEW
        items: { create: prepared }, // include ile uyumlu
      },
      include: {
        items: { include: { category: true, variant: true } },
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (e: any) {
    console.error('POST /orders error', e)
    return NextResponse.json({ error: 'server_error', details: e?.message }, { status: 500 })
  }
}