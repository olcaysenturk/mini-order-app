// app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma, OrderStatus } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'

export const runtime = 'nodejs'

/* ---------- Consts ---------- */
const IST_TZ = 'Europe/Istanbul' as const

/* ---------- Date helpers ---------- */
const parseISODate = (s: string | null) => {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Varsayılan statüler: aktif sayılan tüm durumlar (cancelled hariç) */
const DEFAULT_STATUSES: OrderStatus[] = ['pending','processing','completed','workshop']
function parseStatuses(s: string | null): OrderStatus[] {
  if (!s) return DEFAULT_STATUSES
  const allowed: OrderStatus[] = ['pending','processing','completed','workshop']
  const set = new Set(
    s.split(',').map(x => x.trim()).filter(Boolean) as OrderStatus[]
  )
  const valid = [...set].filter(x => allowed.includes(x))
  return valid.length ? (valid as OrderStatus[]) : DEFAULT_STATUSES
}

/** ARRAY parametre cast’i: "OrderStatus"[] için güvenli oluşturucu */
function orderStatusArray(statuses: OrderStatus[]) {
  // ARRAY['pending'::"OrderStatus",'processing'::"OrderStatus", ...]
  const casted = statuses.map(s => Prisma.sql`${s}::"OrderStatus"`)
  return Prisma.sql`ARRAY[${Prisma.join(casted)}]::"OrderStatus"[]`
}

// Opsiyonel branch filtresi SQL parçası
function branchFilterSql(branchId: string | null) {
  return branchId
    ? Prisma.sql` AND o."branchId" = ${branchId} `
    : Prisma.sql``
}

// Silinmemiş sipariş filtresi (alias'a göre)
function notDeleted(alias: 'o' | 'o1' | 'o2' = 'o') {
  return Prisma.sql` AND ${Prisma.raw(alias)}."deletedAt" IS NULL `
}

/* ---------- Handler ---------- */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | null
    if (!tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const section = (req.nextUrl.searchParams.get('section') || 'overview').toLowerCase()
    const statuses = parseStatuses(req.nextUrl.searchParams.get('status'))

    // Status array (enum cast fix)
    const statusArray = orderStatusArray(statuses)
    // Global kural: orderType = 1 dahil edilmez
    const orderTypeFilter = Prisma.sql` AND COALESCE(o."orderType", 0) <> 1 `

    /* ======= SECTION: OVERVIEW ======= */
    if (section === 'overview') {
      const totalsRow = await prisma.$queryRaw<
        { day: number | null; week: number | null; month: number | null; year: number | null }[]
      >(Prisma.sql`
        WITH now_ist AS (
          SELECT (NOW() AT TIME ZONE ${IST_TZ}) AS ts
        ),
        bounds AS (
          SELECT
            (SELECT ts::date               FROM now_ist) AS today_d,
            (SELECT date_trunc('week',  ts)::date FROM now_ist) AS sow_d,
            (SELECT date_trunc('month', ts)::date FROM now_ist) AS som_d,
            (SELECT date_trunc('year',  ts)::date FROM now_ist) AS soy_d
        )
        SELECT
          COALESCE(SUM(CASE WHEN (o."createdAt" AT TIME ZONE ${IST_TZ})::date = b.today_d THEN o."netTotal" ELSE 0 END), 0)::float AS day,
          COALESCE(SUM(CASE WHEN (o."createdAt" AT TIME ZONE ${IST_TZ})::date >= b.sow_d   AND (o."createdAt" AT TIME ZONE ${IST_TZ})::date <= b.today_d THEN o."netTotal" ELSE 0 END), 0)::float AS week,
          COALESCE(SUM(CASE WHEN (o."createdAt" AT TIME ZONE ${IST_TZ})::date >= b.som_d   AND (o."createdAt" AT TIME ZONE ${IST_TZ})::date <= b.today_d THEN o."netTotal" ELSE 0 END), 0)::float AS month,
          COALESCE(SUM(CASE WHEN (o."createdAt" AT TIME ZONE ${IST_TZ})::date >= b.soy_d   AND (o."createdAt" AT TIME ZONE ${IST_TZ})::date <= b.today_d THEN o."netTotal" ELSE 0 END), 0)::float AS year
        FROM "Order" o, bounds b
        WHERE o."tenantId" = ${tenantId}
          AND o."status" = ANY(${statusArray})
          ${orderTypeFilter}
          ${notDeleted('o')}
      `)
      const totals = totalsRow[0] ?? { day: 0, week: 0, month: 0, year: 0 }

      // Son 30 gün (IST’e normalize)
      const rows = await prisma.$queryRaw<{ d: Date; total: number | null }[]>(
        Prisma.sql`
          WITH days AS (
            SELECT generate_series(
              (NOW() AT TIME ZONE ${IST_TZ})::date - INTERVAL '29 day',
              (NOW() AT TIME ZONE ${IST_TZ})::date,
              INTERVAL '1 day'
            )::date AS d
          ),
          agg AS (
            SELECT
              (o."createdAt" AT TIME ZONE ${IST_TZ})::date AS d,
              COALESCE(SUM(o."netTotal"), 0)::float AS total
            FROM "Order" o
            WHERE o."tenantId" = ${tenantId}
              AND o."status" = ANY(${statusArray})
              ${orderTypeFilter}
              ${notDeleted('o')}
            GROUP BY 1
          )
          SELECT d.d, COALESCE(a.total, 0)::float AS total
          FROM days d
          LEFT JOIN agg a ON a.d = d.d
          ORDER BY d.d ASC
        `
      )

      const series = rows.map(r => ({
        date: r.d.toISOString().slice(0,10),
        total: Number(r.total ?? 0),
      }))

      return NextResponse.json({
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
      }, { headers: { 'Cache-Control': 'private, max-age=60' } })
    }

    /* ======= SECTION: PAYMENTS ======= */
    if (section === 'payments') {
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
            JOIN "Order" o2 ON o2."id" = op."orderId"
                           AND o2."tenantId" = ${tenantId}
                           AND o2."status" = ANY(${statusArray})
                           AND COALESCE(o2."orderType",0) <> 1
                           ${notDeleted('o2')}
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
            ${orderTypeFilter}
            ${notDeleted('o')}
        `
      )
      const s = summary[0] ?? { paid_amount: 0, paid_count: 0, unpaid_amount: 0, unpaid_count: 0 }

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
            ${orderTypeFilter}
            ${notDeleted('o')}
          GROUP BY 1
          ORDER BY amount DESC
        `
      )

      // Son 30 gün kümülatif (IST)
      const rowsOrders = await prisma.$queryRaw<{ d: Date; total: number | null }[]>(
        Prisma.sql`
          SELECT (o."createdAt" AT TIME ZONE ${IST_TZ})::date AS d,
                 COALESCE(SUM(o."netTotal"), 0)::float  AS total
          FROM "Order" o
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            ${orderTypeFilter}
            ${notDeleted('o')}
          GROUP BY 1
        `
      )
      const rowsPaid = await prisma.$queryRaw<{ d: Date; paid: number | null }[]>(
        Prisma.sql`
          SELECT (op."paidAt" AT TIME ZONE ${IST_TZ})::date AS d,
                 COALESCE(SUM(op."amount"), 0)::float  AS paid
          FROM "OrderPayment" op
          JOIN "Order" o ON o."id" = op."orderId"
          WHERE op."tenantId" = ${tenantId}
            AND o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            AND op."paidAt" IS NOT NULL
            ${orderTypeFilter}
            ${notDeleted('o')}
          GROUP BY 1
        `
      )

      const daysRows = await prisma.$queryRaw<{ d: Date }[]>(
        Prisma.sql`
          SELECT generate_series(
            (NOW() AT TIME ZONE ${IST_TZ})::date - INTERVAL '29 day',
            (NOW() AT TIME ZONE ${IST_TZ})::date,
            INTERVAL '1 day'
          )::date AS d
        `
      )

      const mOrders = new Map<string, number>()
      for (const r of rowsOrders) mOrders.set(r.d.toISOString().slice(0,10), Number(r.total ?? 0))
      const mPaid = new Map<string, number>()
      for (const r of rowsPaid) mPaid.set(r.d.toISOString().slice(0,10), Number(r.paid ?? 0))

      let accOrders = 0, accPaid = 0
      const cumulative = daysRows
        .sort((a,b) => +a.d - +b.d)
        .map(({ d }) => {
          const key = d.toISOString().slice(0,10)
          accOrders += mOrders.get(key) ?? 0
          accPaid   += mPaid.get(key) ?? 0
          return { date: key, paid: accPaid, unpaid: Math.max(0, accOrders - accPaid) }
        })

      return NextResponse.json({
        paid:   { amount: Number(s.paid_amount ?? 0),   count: Number(s.paid_count ?? 0) },
        unpaid: { amount: Number(s.unpaid_amount ?? 0), count: Number(s.unpaid_count ?? 0) },
        methods,
        last30dCumulative: cumulative,
      }, { headers: { 'Cache-Control': 'private, max-age=60' } })
    }

    /* ======= SECTION: ITEMS_AGG ======= */
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
          ${orderTypeFilter}
          ${notDeleted('o')}
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

    /* ======= SECTION: DAILY ======= */
    if (section === 'daily') {
      const rowsRev = await prisma.$queryRaw<{ d: Date; revenue: number | null }[]>(
        Prisma.sql`
          SELECT (o."createdAt" AT TIME ZONE ${IST_TZ})::date AS d,
                 COALESCE(SUM(o."netTotal"), 0)::float  AS revenue
          FROM "Order" o
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            ${orderTypeFilter}
            ${notDeleted('o')}
          GROUP BY 1
        `
      )
      const rowsPaid = await prisma.$queryRaw<{ d: Date; paid: number | null }[]>(
        Prisma.sql`
          SELECT (op."paidAt" AT TIME ZONE ${IST_TZ})::date AS d,
                 COALESCE(SUM(op."amount"), 0)::float  AS paid
          FROM "OrderPayment" op
          JOIN "Order" o ON o."id" = op."orderId"
          WHERE op."tenantId" = ${tenantId}
            AND o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            AND op."paidAt" IS NOT NULL
            ${orderTypeFilter}
            ${notDeleted('o')}
          GROUP BY 1
        `
      )
      const daysRows = await prisma.$queryRaw<{ d: Date }[]>(
        Prisma.sql`
          SELECT generate_series(
            (NOW() AT TIME ZONE ${IST_TZ})::date - INTERVAL '29 day',
            (NOW() AT TIME ZONE ${IST_TZ})::date,
            INTERVAL '1 day'
          )::date AS d
        `
      )
      const mRev = new Map<string, number>()
      for (const r of rowsRev) mRev.set(r.d.toISOString().slice(0,10), Number(r.revenue ?? 0))
      const mPaid = new Map<string, number>()
      for (const r of rowsPaid) mPaid.set(r.d.toISOString().slice(0,10), Number(r.paid ?? 0))
      const last30d = daysRows
        .sort((a,b) => +a.d - +b.d)
        .map(({ d }) => {
          const key = d.toISOString().slice(0,10)
          return { date: key, revenue: mRev.get(key) ?? 0, paid: mPaid.get(key) ?? 0 }
        })

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
            ${orderTypeFilter}
            ${notDeleted('o')}
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
            ${orderTypeFilter}
            ${notDeleted('o')}
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
            ${orderTypeFilter}
            ${notDeleted('o')}
          GROUP BY 1
          ORDER BY amount DESC
          LIMIT 20
        `
      )
      return NextResponse.json({ topCustomers: rows }, { headers: { 'Cache-Control': 'private, max-age=120' } })
    }

    /* ======= SECTION: PRODUCTS ======= */
    if (section === 'products') {
      const q = (req.nextUrl.searchParams.get('q') || '').trim();
      const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
      const pageSize = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));
      const sort = (req.nextUrl.searchParams.get('sort') || 'amount').toLowerCase();
      const dir = (req.nextUrl.searchParams.get('dir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const sortSql =
        sort === 'qty'  ? Prisma.sql`qty ${Prisma.raw(dir)}`
      : sort === 'area' ? Prisma.sql`area_m2 ${Prisma.raw(dir)}`
      : sort === 'product' ? Prisma.sql`product ${Prisma.raw(dir)}`
      : Prisma.sql`amount ${Prisma.raw(dir)}`; // default amount

      const whereSearch = q
        ? Prisma.sql` AND COALESCE(v."name",'Ürün') ILIKE ${'%' + q + '%'} `
        : Prisma.sql``;

      const totalRows = await prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total FROM (
          SELECT COALESCE(v."name",'Ürün') AS product
          FROM "OrderItem" oi
          JOIN "Order" o ON o."id" = oi."orderId"
          LEFT JOIN "Variant" v ON v."id" = oi."variantId"
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            AND COALESCE(o."orderType",0) <> 1
            ${notDeleted('o')}
            ${whereSearch}
          GROUP BY 1
        ) t
      `);
      const total = Number(totalRows?.[0]?.total ?? 0);
      const offset = (page - 1) * pageSize;

      const rows = await prisma.$queryRaw<{ product: string; qty: number; area_m2: number; amount: number }[]>(Prisma.sql`
        SELECT
          COALESCE(v."name",'Ürün') AS product,
          COALESCE(SUM(oi."qty"), 0)::int AS qty,
          COALESCE(SUM( ((oi."width" * oi."height") / 10000.0) * oi."qty" ), 0)::float AS area_m2,
          COALESCE(SUM(oi."subtotal"), 0)::float AS amount
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        LEFT JOIN "Variant" v ON v."id" = oi."variantId"
        WHERE o."tenantId" = ${tenantId}
          AND o."status" = ANY(${statusArray})
          AND COALESCE(o."orderType",0) <> 1
          ${notDeleted('o')}
          ${whereSearch}
        GROUP BY 1
        ORDER BY ${sortSql}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      return NextResponse.json({
        rows: rows.map(r => ({
          product: r.product,
          qty: Number(r.qty ?? 0),
          areaM2: Number(r.area_m2 ?? 0),
          amount: Number(r.amount ?? 0),
        })),
        total,
        page,
        pageSize,
      }, { headers: { 'Cache-Control': 'private, max-age=30' } });
    }

    /* ======= SECTION: BRANCHES ======= */
    if (section === 'branches') {
      const rows = await prisma.$queryRaw<{
        branchId: string | null; branch: string | null; code: string | null;
        orders: number; revenue: number; paid: number
      }[]>(
        Prisma.sql`
          WITH p AS (
            SELECT op."orderId", SUM(op."amount")::float AS paid
            FROM "OrderPayment" op
            JOIN "Order" o1 ON o1."id" = op."orderId"
                           AND o1."tenantId" = ${tenantId}
                           AND o1."status" = ANY(${statusArray})
                           AND COALESCE(o1."orderType",0) <> 1
                           ${notDeleted('o1')}
            WHERE op."tenantId" = ${tenantId}
            GROUP BY op."orderId"
          )
          SELECT
            b."id"::text AS "branchId",
            COALESCE(b."name", 'Şube') AS branch,
            b."code"::text AS code,
            COUNT(*)::int                                         AS orders,
            COALESCE(SUM(o."netTotal"), 0)::float                 AS revenue,
            COALESCE(SUM(COALESCE(p.paid, 0)), 0)::float          AS paid
          FROM "Order" o
          LEFT JOIN p       ON p."orderId" = o."id"
          LEFT JOIN "Branch" b ON b."id" = o."branchId"
          WHERE o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            ${orderTypeFilter}
            ${notDeleted('o')}
          GROUP BY b."id", b."name", b."code"
          ORDER BY revenue DESC
        `
      )

      const byBranch = rows.map(r => ({
        branchId: r.branchId,
        branch: r.branch ?? 'Şube',
        code: r.code,
        orders: Number(r.orders ?? 0),
        revenue: Number(r.revenue ?? 0),
        paid: Number(r.paid ?? 0),
      }))

      return NextResponse.json({ byBranch }, { headers: { 'Cache-Control': 'private, max-age=120' } })
    }

    /* ======= SECTION: DAILY_BY_BRANCH ======= */
    if (section === 'daily_by_branch') {
      const branchId = req.nextUrl.searchParams.get('branchId')
      const from = parseISODate(req.nextUrl.searchParams.get('from'))
      const to = parseISODate(req.nextUrl.searchParams.get('to'))
      if (!branchId || !from || !to) {
        return NextResponse.json({ lastByBranch: [] }, { headers: { 'Cache-Control': 'private, max-age=30' } })
      }
      const fromDate = from.toISOString().slice(0,10)
      const toDate   = to.toISOString().slice(0,10)

      const rowsOrder = await prisma.$queryRaw<{ d: Date; revenue: number | null }[]>(
        Prisma.sql`
          SELECT (o."createdAt" AT TIME ZONE ${IST_TZ})::date AS d,
                 COALESCE(SUM(o."netTotal"), 0)::float  AS revenue
          FROM "Order" o
          WHERE o."tenantId" = ${tenantId}
            AND (o."createdAt" AT TIME ZONE ${IST_TZ})::date BETWEEN ${fromDate}::date AND ${toDate}::date
            AND o."status" = ANY(${statusArray})
            ${orderTypeFilter}
            ${branchFilterSql(branchId)}
            ${notDeleted('o')}
          GROUP BY 1
          ORDER BY 1 ASC
        `
      )

      const rowsPaid = await prisma.$queryRaw<{ d: Date; paid: number | null }[]>(
        Prisma.sql`
          SELECT (op."paidAt" AT TIME ZONE ${IST_TZ})::date AS d,
                 COALESCE(SUM(op."amount"), 0)::float  AS paid
          FROM "OrderPayment" op
          JOIN "Order" o ON o."id" = op."orderId"
          WHERE op."tenantId" = ${tenantId}
            AND o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            AND op."paidAt" IS NOT NULL
            AND (op."paidAt" AT TIME ZONE ${IST_TZ})::date BETWEEN ${fromDate}::date AND ${toDate}::date
            ${orderTypeFilter}
            ${branchFilterSql(branchId)}
            ${notDeleted('o')}
          GROUP BY 1
          ORDER BY 1 ASC
        `
      )

      const daysRows = await prisma.$queryRaw<{ d: Date }[]>(
        Prisma.sql`
          SELECT generate_series(${fromDate}::date, ${toDate}::date, INTERVAL '1 day')::date AS d
        `
      )

      const mRev = new Map<string, number>()
      for (const r of rowsOrder) mRev.set(r.d.toISOString().slice(0,10), Number(r.revenue ?? 0))
      const mPaid = new Map<string, number>()
      for (const r of rowsPaid) mPaid.set(r.d.toISOString().slice(0,10), Number(r.paid ?? 0))

      const lastByBranch = daysRows
        .sort((a,b) => +a.d - +b.d)
        .map(({ d }) => {
          const key = d.toISOString().slice(0,10)
          return { date: key, revenue: mRev.get(key) ?? 0, paid: mPaid.get(key) ?? 0 }
        })

      return NextResponse.json({ lastByBranch }, { headers: { 'Cache-Control': 'private, max-age=30' } })
    }

    /* ======= SECTION: METHODS_BY_DATE ======= */
    if (section === 'methods_by_date') {
      const branchId = req.nextUrl.searchParams.get('branchId')
      const from = parseISODate(req.nextUrl.searchParams.get('from'))
      const to = parseISODate(req.nextUrl.searchParams.get('to'))
      if (!branchId || !from || !to) {
        return NextResponse.json({ methods: [] }, { headers: { 'Cache-Control': 'private, max-age=30' } })
      }
      const fromDate = from.toISOString().slice(0,10)
      const toDate   = to.toISOString().slice(0,10)

      const rows = await prisma.$queryRaw<{ d: Date; method: string; amount: number | null }[]>(
        Prisma.sql`
          SELECT
            (op."paidAt" AT TIME ZONE ${IST_TZ})::date AS d,
            COALESCE(op."method"::text,'UNKNOWN')     AS method,
            COALESCE(SUM(op."amount"), 0)::float      AS amount
          FROM "OrderPayment" op
          JOIN "Order" o ON o."id" = op."orderId"
          WHERE op."tenantId" = ${tenantId}
            AND o."tenantId" = ${tenantId}
            AND o."status" = ANY(${statusArray})
            AND op."paidAt" IS NOT NULL
            AND (op."paidAt" AT TIME ZONE ${IST_TZ})::date BETWEEN ${fromDate}::date AND ${toDate}::date
            ${orderTypeFilter}
            ${branchFilterSql(branchId)}
            ${notDeleted('o')}
          GROUP BY 1, 2
          ORDER BY 1 DESC, 3 DESC
        `
      )

      const methods = rows.map(r => ({
        date: r.d.toISOString().slice(0,10),
        method: r.method,
        amount: Number(r.amount ?? 0),
      }))

      return NextResponse.json({ methods }, { headers: { 'Cache-Control': 'private, max-age=30' } })
    }
    
    /* ======= SECTION: PAYMENTS_DAY_DETAIL ======= */
    if (section === 'payments_day_detail') {
      const branchId = req.nextUrl.searchParams.get('branchId')
      const dateStr = req.nextUrl.searchParams.get('date')
      if (!branchId || !dateStr) {
        return NextResponse.json({ error: 'missing_params' }, { status: 400 })
      }
      
      const targetDate = parseISODate(dateStr)
      if (!targetDate) {
        return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
      }
      const ymd = targetDate.toISOString().slice(0, 10)

      const rows = await prisma.$queryRaw<{
        customerName: string | null;
        amount: number;
        method: string;
        orderId: string;
        note: string | null;
      }[]>(Prisma.sql`
        SELECT
          COALESCE(c."name", o."customerName", 'Müşteri') AS "customerName",
          op."amount"::float                            AS "amount",
          op."method"::text                              AS "method",
          op."orderId"::text                             AS "orderId",
          op."note"::text                                AS "note"
        FROM "OrderPayment" op
        JOIN "Order" o ON o."id" = op."orderId"
        LEFT JOIN "Customer" c ON c."id" = o."customerId"
        WHERE op."tenantId" = ${tenantId}
          AND o."tenantId" = ${tenantId}
          AND o."branchId" = ${branchId}
          AND (op."paidAt" AT TIME ZONE ${IST_TZ})::date = ${ymd}::date
          AND o."status" = ANY(${CastArray(statuses)})
          ${orderTypeFilter}
          ${notDeleted('o')}
        ORDER BY op."paidAt" DESC
      `)

      return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'private, max-age=10' } })
    }

    return NextResponse.json({ error: 'invalid_section' }, { status: 400 })
  } catch (e) {
    console.error('GET /api/reports error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// Helper to cast status array for queryRaw
function CastArray(statuses: OrderStatus[]) {
  const casted = statuses.map(s => Prisma.sql`${s}::"OrderStatus"`)
  return Prisma.sql`ARRAY[${Prisma.join(casted)}]::"OrderStatus"[]`
}
