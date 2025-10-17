// app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma, OrderStatus } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'

export const runtime = 'nodejs'

/* ---------- Date helpers ---------- */
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
const endOfDay   = (d = new Date()) => { const x = new Date(d); x.setHours(23,59,59,999); return x }
const startOfWeek = (d = new Date()) => {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setHours(0,0,0,0); x.setDate(x.getDate() - day); return x
}
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0)
const startOfYear  = (d = new Date()) => new Date(d.getFullYear(), 0, 1, 0,0,0,0)

const DEFAULT_STATUSES: OrderStatus[] = ['pending','processing','completed']
function parseStatuses(s: string | null): OrderStatus[] {
  if (!s) return DEFAULT_STATUSES
  const allowed: OrderStatus[] = ['pending','processing','completed','cancelled']
  const set = new Set(
    s.split(',').map(x => x.trim()).filter(Boolean) as OrderStatus[]
  )
  const valid = [...set].filter(x => allowed.includes(x))
  return valid.length ? (valid as OrderStatus[]) : DEFAULT_STATUSES
}

/* ---------- Handler ---------- */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | null
    if (!tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const section = (req.nextUrl.searchParams.get('section') || 'overview').toLowerCase()
    const statuses = parseStatuses(req.nextUrl.searchParams.get('status'))

    const now = new Date()
    const sod = startOfDay(now)
    const eod = endOfDay(now)
    const sow = startOfWeek(now)
    const som = startOfMonth(now)
    const soy = startOfYear(now)

    const statusArray = Prisma.sql`ARRAY[${Prisma.join(statuses)}]::"OrderStatus"[]`

    /* ======= SECTION: OVERVIEW ======= */
    if (section === 'overview') {
      // KPI: gün/hafta/ay/yıl (netTotal)
      const totalsRow = await prisma.$queryRaw<
        { day: number | null; week: number | null; month: number | null; year: number | null }[]
      >(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${sod} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS day,
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${sow} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS week,
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${som} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS month,
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${soy} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS year
        FROM "Order" o
        WHERE o."tenantId" = ${tenantId}
          AND o."status" = ANY(${statusArray})
      `)
      const totals = totalsRow[0] ?? { day: 0, week: 0, month: 0, year: 0 }

      // Son 30 gün (netTotal)
      const days = 30
      const since = startOfDay(new Date(now))
      since.setDate(since.getDate() - (days - 1))
      const rows = await prisma.$queryRaw<{ d: Date; total: number | null }[]>(
        Prisma.sql`
          SELECT
            DATE_TRUNC('day', o."createdAt")::date AS d,
            COALESCE(SUM(o."netTotal"), 0)::float AS total
          FROM "Order" o
          WHERE o."tenantId" = ${tenantId}
            AND o."createdAt" >= ${since} AND o."createdAt" <= ${eod}
            AND o."status" = ANY(${statusArray})
          GROUP BY 1
          ORDER BY 1 ASC
        `
      )
      const map = new Map<string, number>()
      for (const r of rows) {
        const key = r.d.toISOString().slice(0,10)
        map.set(key, Number(r.total ?? 0))
      }
      const series: { date: string; total: number }[] = []
      for (let i = 30 - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0,10)
        series.push({ date: key, total: map.get(key) ?? 0 })
      }

      const payload = {
        mode: 'from_orders_netTotal',
        statuses,
        currency: 'TRY',
        totals: {
          day: Number(totals.day ?? 0),
          week: Number(totals.week ?? 0),
          month: Number(totals.month ?? 0),
          year: Number(totals.year ?? 0),
        },
        series30d: series,
      }
      return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=60' } })
    }

    /* ======= SECTION: PAYMENTS ======= */
    if (section === 'payments') {
      // Ödeme yapılan/ödenmeyen (orders + payments)
      const summary = await prisma.$queryRaw<{
        paid_amount: number | null
        paid_count: number | null
        unpaid_amount: number | null
        unpaid_count: number | null
      }[]>(
        Prisma.sql`
          WITH paid AS (
            SELECT op."orderId", SUM(op."amount")::float AS paid
            FROM "OrderPayment" op
            JOIN "Order" o2 ON o2."id" = op."orderId" AND o2."tenantId" = ${tenantId} AND o2."status" = ANY(${statusArray})
            WHERE op."tenantId" = ${tenantId}
            GROUP BY op."orderId"
          )
          SELECT
            COALESCE(SUM(LEAST(o."netTotal", COALESCE(p.paid, 0))), 0)::float      AS paid_amount,
            COUNT(*) FILTER (WHERE COALESCE(p.paid,0) >= o."netTotal")::int        AS paid_count,
            COALESCE(SUM(GREATEST(o."netTotal" - COALESCE(p.paid, 0), 0)), 0)::float AS unpaid_amount,
            COUNT(*) FILTER (WHERE COALESCE(p.paid,0) <  o."netTotal")::int        AS unpaid_count
          FROM "Order" o
          LEFT JOIN paid p ON p."orderId" = o."id"
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
        `
      )
      const s = summary[0] ?? { paid_amount: 0, paid_count: 0, unpaid_amount: 0, unpaid_count: 0 }

      // Ödeme yöntemi dağılımı
      const methods = await prisma.$queryRaw<{ method: string; amount: number; count: number }[]>(
        Prisma.sql`
          SELECT op."method"::text as method,
                 COALESCE(SUM(op."amount"), 0)::float AS amount,
                 COUNT(*)::int AS count
          FROM "OrderPayment" op
          JOIN "Order" o ON o."id" = op."orderId"
          WHERE op."tenantId" = ${tenantId}
            AND o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
          GROUP BY 1
          ORDER BY amount DESC
        `
      )

      // Son 30 gün kümülatif (netTotal vs paid)
      const days = 30
      const since = startOfDay(new Date(now))
      since.setDate(since.getDate() - (days - 1))

      const byOrder = await prisma.$queryRaw<{ d: Date; total: number | null }[]>(
        Prisma.sql`
          SELECT DATE_TRUNC('day', o."createdAt")::date AS d,
                 COALESCE(SUM(o."netTotal"), 0)::float  AS total
          FROM "Order" o
          WHERE o."tenantId" = ${tenantId}
            AND o."createdAt" >= ${since} AND o."createdAt" <= ${eod}
            AND o."status" = ANY(${statusArray})
          GROUP BY 1
          ORDER BY 1 ASC
        `
      )
      const byPay = await prisma.$queryRaw<{ d: Date; paid: number | null }[]>(
        Prisma.sql`
          SELECT DATE_TRUNC('day', op."paidAt")::date AS d,
                 COALESCE(SUM(op."amount"), 0)::float  AS paid
          FROM "OrderPayment" op
          JOIN "Order" o ON o."id" = op."orderId"
          WHERE op."tenantId" = ${tenantId}
            AND o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            AND op."paidAt" >= ${since} AND op."paidAt" <= ${eod}
          GROUP BY 1
          ORDER BY 1 ASC
        `
      )
      const mOrders = new Map<string, number>()
      for (const r of byOrder) mOrders.set(r.d.toISOString().slice(0,10), Number(r.total ?? 0))
      const mPaid = new Map<string, number>()
      for (const r of byPay) mPaid.set(r.d.toISOString().slice(0,10), Number(r.paid ?? 0))
      const cumulative: { date: string; paid: number; unpaid: number }[] = []
      let accOrders = 0, accPaid = 0
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0,10)
        accOrders += mOrders.get(key) ?? 0
        accPaid   += mPaid.get(key) ?? 0
        cumulative.push({ date: key, paid: accPaid, unpaid: Math.max(0, accOrders - accPaid) })
      }

      return NextResponse.json({
        paid:   { amount: Number(s.paid_amount ?? 0),   count: Number(s.paid_count ?? 0) },
        unpaid: { amount: Number(s.unpaid_amount ?? 0), count: Number(s.unpaid_count ?? 0) },
        methods,
        last30dCumulative: cumulative,
      }, { headers: { 'Cache-Control': 'private, max-age=60' } })
    }

    if (section === 'items_agg') {
  const rows = await prisma.$queryRaw<
    { group: string | null; qty: number | null; amount: number | null; total_width_cm: number | null; total_height_cm: number | null }[]
  >(Prisma.sql`
    SELECT
      COALESCE(c."name", 'Ürün') AS group,
      COALESCE(SUM(oi."qty"), 0)::int AS qty,
      COALESCE(SUM(oi."subtotal"), 0)::float AS amount,
      COALESCE(SUM((oi."width") * (oi."qty")), 0)::float  AS total_width_cm,
      COALESCE(SUM((oi."height") * (oi."qty")), 0)::float AS total_height_cm
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Category" c ON c."id" = oi."categoryId"
    WHERE o."tenantId" = ${tenantId}
      AND o."status" = ANY(${statusArray})
    GROUP BY 1
    ORDER BY amount DESC
  `)

  return NextResponse.json({
    byProduct: rows.map(r => ({
      group: r.group ?? 'Ürün',
      qty: Number(r.qty ?? 0),
      amount: Number(r.amount ?? 0),
      totalWidthCm: Number(r.total_width_cm ?? 0),
      totalHeightCm: Number(r.total_height_cm ?? 0),
    })),
  }, { headers: { 'Cache-Control': 'private, max-age=120' } })
}

    /* ======= SECTION: DAILY (NEW) ======= */
    if (section === 'daily') {
      const days = 30
      const since = startOfDay(new Date(now))
      since.setDate(since.getDate() - (days - 1))

      // Günlük ciro (netTotal) — createdAt
      const byOrder = await prisma.$queryRaw<{ d: Date; revenue: number | null }[]>(
        Prisma.sql`
          SELECT DATE_TRUNC('day', o."createdAt")::date AS d,
                 COALESCE(SUM(o."netTotal"), 0)::float  AS revenue
          FROM "Order" o
          WHERE o."tenantId" = ${tenantId}
            AND o."createdAt" >= ${since} AND o."createdAt" <= ${eod}
            AND o."status" = ANY(${statusArray})
          GROUP BY 1
          ORDER BY 1 ASC
        `
      )
      // Günlük tahsilat — paidAt
      const byPay = await prisma.$queryRaw<{ d: Date; paid: number | null }[]>(
        Prisma.sql`
          SELECT DATE_TRUNC('day', op."paidAt")::date AS d,
                 COALESCE(SUM(op."amount"), 0)::float  AS paid
          FROM "OrderPayment" op
          JOIN "Order" o ON o."id" = op."orderId"
          WHERE op."tenantId" = ${tenantId}
            AND o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            AND op."paidAt" >= ${since} AND op."paidAt" <= ${eod}
          GROUP BY 1
          ORDER BY 1 ASC
        `
      )

      const mRev = new Map<string, number>()
      for (const r of byOrder) mRev.set(r.d.toISOString().slice(0,10), Number(r.revenue ?? 0))
      const mPaid = new Map<string, number>()
      for (const r of byPay) mPaid.set(r.d.toISOString().slice(0,10), Number(r.paid ?? 0))

      const last30d: { date: string; revenue: number; paid: number }[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0,10)
        last30d.push({ date: key, revenue: mRev.get(key) ?? 0, paid: mPaid.get(key) ?? 0 })
      }

      return NextResponse.json({ last30d }, { headers: { 'Cache-Control': 'private, max-age=60' } })
    }

    /* ======= SECTION: CATEGORIES ======= */
    if (section === 'categories') {
      const rows = await prisma.$queryRaw<{ category: string; amount: number; qty: number }[]>(
        Prisma.sql`
          SELECT c."name" AS category,
                 COALESCE(SUM(oi."subtotal"), 0)::float AS amount,
                 COALESCE(SUM(oi."qty"), 0)::int        AS qty
          FROM "OrderItem" oi
          JOIN "Order" o   ON o."id" = oi."orderId"
          JOIN "Category" c ON c."id" = oi."categoryId"
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
          GROUP BY c."name"
          ORDER BY amount DESC
        `
      )
      return NextResponse.json({ byCategory: rows }, { headers: { 'Cache-Control': 'private, max-age=120' } })
    }

    /* ======= SECTION: VARIANTS ======= */
    if (section === 'variants') {
      const rows = await prisma.$queryRaw<{ variant: string; category: string; amount: number; qty: number }[]>(
        Prisma.sql`
          SELECT v."name" AS variant,
                 c."name" AS category,
                 COALESCE(SUM(oi."subtotal"), 0)::float AS amount,
                 COALESCE(SUM(oi."qty"), 0)::int        AS qty
          FROM "OrderItem" oi
          JOIN "Order"  o ON o."id" = oi."orderId"
          JOIN "Variant" v ON v."id" = oi."variantId"
          JOIN "Category" c ON c."id" = oi."categoryId"
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
          GROUP BY v."name", c."name"
          ORDER BY amount DESC
          LIMIT 20
        `
      )
      return NextResponse.json({ topVariants: rows }, { headers: { 'Cache-Control': 'private, max-age=120' } })
    }

    /* ======= SECTION: CUSTOMERS ======= */
    if (section === 'customers') {
      const rows = await prisma.$queryRaw<{ customer: string | null; orders: number; amount: number }[]>(
        Prisma.sql`
          SELECT COALESCE(c."name", NULLIF(TRIM(o."customerName"), ''), 'Müşteri') AS customer,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM(o."netTotal"), 0)::float AS amount
          FROM "Order" o
          LEFT JOIN "Customer" c ON c."id" = o."customerId"
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
          GROUP BY 1
          ORDER BY amount DESC
          LIMIT 20
        `
      )
      return NextResponse.json({ topCustomers: rows }, { headers: { 'Cache-Control': 'private, max-age=120' } })
    }

    /* ======= SECTION: DEALERS (NEW) ======= */
    if (section === 'dealers') {
      // "Bayi" olarak müşteri adını kullanıyoruz (Customer.name varsa o, yoksa Order.customerName, yoksa 'Müşteri')
      // Hem ciro (netTotal) hem tahsilat (OrderPayment.amount) aynı filtrelerle toplanır.
      const rows = await prisma.$queryRaw<{ dealer: string | null; orders: number; revenue: number; paid: number }[]>(
        Prisma.sql`
          WITH p AS (
            SELECT op."orderId", SUM(op."amount")::float AS paid
            FROM "OrderPayment" op
            JOIN "Order" o1 ON o1."id" = op."orderId" AND o1."tenantId" = ${tenantId} AND o1."status" = ANY(${statusArray})
            WHERE op."tenantId" = ${tenantId}
            GROUP BY op."orderId"
          )
          SELECT
            COALESCE(c."name", NULLIF(TRIM(o."customerName"), ''), 'Müşteri') AS dealer,
            COUNT(*)::int                                         AS orders,
            COALESCE(SUM(o."netTotal"), 0)::float                 AS revenue,
            COALESCE(SUM(COALESCE(p.paid, 0)), 0)::float          AS paid
          FROM "Order" o
          LEFT JOIN p            ON p."orderId" = o."id"
          LEFT JOIN "Customer" c ON c."id" = o."customerId"
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
          GROUP BY 1
          ORDER BY revenue DESC
        `
      )

      // sayısal cast ve null güvenliği
      const byDealer = rows.map(r => ({
        dealer: r.dealer ?? 'Müşteri',
        orders: Number(r.orders ?? 0),
        revenue: Number(r.revenue ?? 0),
        paid: Number(r.paid ?? 0),
      }))

      return NextResponse.json({ byDealer }, { headers: { 'Cache-Control': 'private, max-age=120' } })
    }

    // bilinmeyen section -> 400
    return NextResponse.json({ error: 'invalid_section' }, { status: 400 })
  } catch (e) {
    console.error('GET /api/reports error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
