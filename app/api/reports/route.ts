// app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { OrderStatus } from '@prisma/client'

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

async function sumRangeRobust(gte: Date, lte: Date, statuses: OrderStatus[]) {
  const [items, extras] = await Promise.all([
    prisma.orderItem.aggregate({
      _sum: { subtotal: true },
      where: { order: { createdAt: { gte, lte }, status: { in: statuses } } },
    }),
    prisma.orderExtra.aggregate({
      _sum: { subtotal: true },
      where: { order: { createdAt: { gte, lte }, status: { in: statuses } } },
    }),
  ])
  const a = Number(items._sum.subtotal ?? 0)
  const b = Number(extras._sum.subtotal ?? 0)
  return a + b
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date()
    const statuses = parseStatuses(req.nextUrl.searchParams.get('status'))

    const [day, week, month, year] = await Promise.all([
      sumRangeRobust(startOfDay(now), endOfDay(now), statuses),
      sumRangeRobust(startOfWeek(now), endOfDay(now), statuses),
      sumRangeRobust(startOfMonth(now), endOfDay(now), statuses),
      sumRangeRobust(startOfYear(now), endOfDay(now), statuses),
    ])

    // Son 30 gün için günlük seri
    const days = 30
    const series: { date: string; total: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const gte = startOfDay(d)
      const lte = endOfDay(d)
      const total = await sumRangeRobust(gte, lte, statuses)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      series.push({ date: `${yyyy}-${mm}-${dd}`, total })
    }

    return NextResponse.json({
      mode: 'recomputed_from_items_and_extras',
      statuses,
      currency: 'TRY',
      totals: { day, week, month, year },
      series30d: series,
    })
  } catch (e) {
    console.error('GET /api/reports error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
