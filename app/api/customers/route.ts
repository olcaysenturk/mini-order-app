// app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'

export const runtime = 'nodejs'

// GET /api/customers?q=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) {
    const last = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, phone: true, email: true }
    })
    return NextResponse.json(last)
  }

  const rows = await prisma.customer.findMany({
    where: {
      OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    },
    orderBy: [{ name: 'asc' }],
    take: 20,
    select: { id: true, name: true, phone: true, email: true }
  })
  return NextResponse.json(rows)
}

// POST /api/customers
// body: {name, phone, email?, address?, note?}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = String(body?.name || '').trim()
    const phone = String(body?.phone || '').trim()

    if (!name || !phone) {
      return NextResponse.json({ error: 'name_and_phone_required' }, { status: 400 })
    }

    // phone unique
    const existing = await prisma.customer.findUnique({ where: { phone } })
    if (existing) return NextResponse.json(existing, { status: 200 })

    const created = await prisma.customer.create({
      data: {
        name,
        phone,
        email: body?.email || null,
        address: body?.address || null,
        note: body?.note || null,
      },
      select: { id: true, name: true, phone: true, email: true }
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('POST /customers error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
