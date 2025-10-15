// app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'

const CreateSchema = z.object({
  name: z.string().trim().min(1, 'Müşteri adı zorunlu'),
  phone: z.string().trim().min(3, 'Telefon zorunlu'),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
})

/**
 * LISTE: GET /api/customers?q=...&page=1&pageSize=20
 * Ad/telefon/email içinde arar, sayfalı döner.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))

    const where: Prisma.CustomerWhereInput = q
      ? {
          tenantId,
          OR: [
            { name:  { contains: q, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : { tenantId }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, phone: true, email: true, createdAt: true },
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({ ok: true, items, total, page, pageSize })
  } catch (e) {
    console.error('GET /api/customers error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/**
 * OLUŞTUR: POST /api/customers
 * Aynı telefon (aynı tenant’ta) varsa mevcut müşteriyi döner.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { name, phone, email, address, note } = parsed.data

    // Composite unique ile doğrudan kontrol
    const existing = await prisma.customer.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
      select: { id: true, name: true, phone: true, email: true },
    })
    if (existing) {
      return NextResponse.json({ ok: true, customer: existing, existed: true }, { status: 200 })
    }

    const created = await prisma.customer.create({
      data: {
        tenantId,
        name,
        phone,
        email: email || null,
        address: address || null,
        note: note || null,
      },
      select: { id: true, name: true, phone: true, email: true },
    })

    return NextResponse.json({ ok: true, customer: created, existed: false }, { status: 201 })
  } catch (e: any) {
    // Prisma unique ihlali (yine de güvence)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'customer_phone_in_use' }, { status: 409 })
    }
    console.error('POST /api/customers error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
