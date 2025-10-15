// app/api/dealers/route.ts
import { prisma } from '@/app/lib/db'
import { requireTenantId, jsonError } from '@/app/lib/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client' // 👈 EKLE

export const runtime = 'nodejs'

const DealerSchema = z.object({
  name: z.string().min(1),
  code: z.string().trim().max(50).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function POST(req: Request) {
  try {
    const tenantId = await requireTenantId()
    const body = await req.json()
    const parsed = DealerSchema.safeParse(body)
    if (!parsed.success) return jsonError('validation_error', 422)

    // isim tekilliği
    const dup = await prisma.dealer.findFirst({
      where: { tenantId, name: parsed.data.name },
      select: { id: true },
    })
    if (dup) return jsonError('dealer_name_in_use', 409)

    // code tekilliği (varsa)
    if (parsed.data.code) {
      const dupCode = await prisma.dealer.findFirst({
        where: { tenantId, code: parsed.data.code },
        select: { id: true },
      })
      if (dupCode) return jsonError('dealer_code_in_use', 409)
    }

    const created = await prisma.dealer.create({
      data: { tenantId, ...parsed.data },
      select: { id: true, name: true },
    })
    return Response.json({ ok: true, dealer: created }, { status: 201 })
  } catch (e: any) {
    if (e?.message === 'NO_TENANT') return jsonError('unauthorized', 401)
    return jsonError('server_error', 500)
  }
}

// Listeleme: ?q=arama&page=1&pageSize=20&active=1
export async function GET(req: Request) {
  try {
    const tenantId = await requireTenantId()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
    const activeParam = searchParams.get('active')
    const isActive = activeParam == null ? undefined : activeParam === '1'

    const modeIns: Prisma.QueryMode = 'insensitive' // 👈 string değil, tip güvenli sabit

    // where’i Prisma tipiyle tanımla
    const where: Prisma.DealerWhereInput = {
      tenantId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(q
        ? {
            OR: [
              { name:  { contains: q, mode: modeIns } },
              { code:  { contains: q, mode: modeIns } },
              { phone: { contains: q, mode: modeIns } },
              { email: { contains: q, mode: modeIns } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.dealer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, code: true, phone: true, email: true,
          isActive: true, createdAt: true,
        },
      }),
      prisma.dealer.count({ where }),
    ])

    return Response.json({ ok: true, items, total, page, pageSize })
  } catch (e: any) {
    if (e?.message === 'NO_TENANT') return jsonError('unauthorized', 401)
    return jsonError('server_error', 500)
  }
}
