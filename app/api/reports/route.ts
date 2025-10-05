// app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma, OrderStatus } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'

export const runtime = 'nodejs'

const startOfDay = (d = new Date()) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const endOfDay = (d = new Date()) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
const startOfWeek = (d = new Date()) => {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // Pazartesi=0
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - day)
  return x
}
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)

const DEFAULT_STATUSES: OrderStatus[] = ['pending', 'processing', 'completed']
function parseStatuses(s: string | null): OrderStatus[] {
  if (!s) return DEFAULT_STATUSES
  const set = new Set(
    s.split(',').map((x) => x.trim()).filter(Boolean) as OrderStatus[]
  )
  const allowed: OrderStatus[] = ['pending', 'processing', 'completed', 'cancelled']
  const valid = [...set].filter((x) => allowed.includes(x))
  return valid.length ? (valid as OrderStatus[]) : DEFAULT_STATUSES
}

export async function GET(req: NextRequest) {
  try {
    // ✅ Multi-tenant güvenliği + indeks kullanımı
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | null
    if (!tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const statuses = parseStatuses(req.nextUrl.searchParams.get('status'))

    const sod = startOfDay(now)
    const sow = startOfWeek(now)
    const som = startOfMonth(now)
    const soy = startOfYear(now)
    const eod = endOfDay(now)

    // Postgres enum array paramı için güvenli ifade
    const statusArray = Prisma.sql`ARRAY[${Prisma.join(statuses)}]::"OrderStatus"[]`

    // 1) Gün/hafta/ay/yıl toplamları — tek sorgu, netTotal üstünden
    const totalsRow = await prisma.$queryRaw<
      { day: number | null; week: number | null; month: number | null; year: number | null }[]
    >(
      Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${sod} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS day,
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${sow} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS week,
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${som} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS month,
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${soy} AND o."createdAt" <= ${eod} THEN o."netTotal" ELSE 0 END), 0)::float AS year
        FROM "Order" o
        WHERE o."tenantId" = ${tenantId}
          AND o."status" = ANY(${statusArray})
      `
    )
    const totals = totalsRow[0] ?? { day: 0, week: 0, month: 0, year: 0 }

    // 2) Son 30 gün — tek sorgu, netTotal + date_trunc('day')
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

    // Eksik günleri 0 ile doldur
    const map = new Map<string, number>()
    for (const r of rows) {
      const yyyy = r.d.getFullYear()
      const mm = String(r.d.getMonth() + 1).padStart(2, '0')
      const dd = String(r.d.getDate()).padStart(2, '0')
      map.set(`${yyyy}-${mm}-${dd}`, Number(r.total ?? 0))
    }
    const series: { date: string; total: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const key = `${yyyy}-${mm}-${dd}`
      series.push({ date: key, total: map.get(key) ?? 0 })
    }

    const payload = {
      mode: 'from_orders_netTotal', // artık tek tablo, hızlı
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

    // Kısa süreli cache (özel)
    const headers = { 'Cache-Control': 'private, max-age=60' }
    return NextResponse.json(payload, { headers })
  } catch (e) {
    console.error('GET /api/reports error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
