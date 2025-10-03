// app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

const CreateSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(3),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
})

/** LISTE: GET /api/customers?q=... */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          tenantId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : { tenantId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(customers)
}

/** OLUŞTUR: POST /api/customers  (aynı telefon aynı tenant'ta varsa onu döndürür) */
export async function POST(req: NextRequest) {
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

  // 🔧 HATA DÜZELTİLDİ: bileşik unique key ile findUnique
  const existing = await prisma.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
  })
  if (existing) return NextResponse.json(existing, { status: 200 })

  const created = await prisma.customer.create({
    data: {
      tenantId,
      name,
      phone,
      email: email || null,
      address: address || null,
      note: note || null,
    },
  })
  return NextResponse.json(created, { status: 201 })
}
