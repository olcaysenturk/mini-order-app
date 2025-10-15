// app/api/branches/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

/* ============== Validation Schemas ============== */
const CreateSchema = z.object({
  name: z.string().trim().min(1, 'Ad zorunlu'),
  code: z.string().trim().max(50).optional().transform(v => (v ? v : undefined)),
  phone: z.string().trim().optional().transform(v => (v ? v : undefined)),
  email: z.string().trim().email().optional().transform(v => (v ? v : undefined)),
  address: z.string().trim().optional().transform(v => (v ? v : undefined)),
  showOnHeader: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

/* ============== GET /api/branches ============== */
/**
 * Query params:
 *  - all=1    -> pasifleri de getir (default: yalnız aktifler)
 *  - q=...    -> ad/kod/telefon araması (case-insensitive)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'
  const q = (searchParams.get('q') || '').trim()

  const where: Prisma.BranchWhereInput = {
    tenantId,
    ...(all ? {} : { isActive: true }),
    ...(q
      ? {
          OR: [
            { name:  { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
            { code:  { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
            { phone: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
          ],
        }
      : {}),
  }

  const items = await prisma.branch.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ ok: true, items })
}

/* ============== POST /api/branches ============== */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const json = await req.json().catch(() => ({}))
  const parsed = CreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const data = parsed.data

  // Aynı tenant içinde isim benzersizliği
  const dup = await prisma.branch.findFirst({
    where: { tenantId, name: data.name },
    select: { id: true },
  })
  if (dup) {
    return NextResponse.json({ error: 'branch_name_in_use' }, { status: 409 })
  }

  const created = await prisma.branch.create({
    data: {
      tenantId,
      name: data.name,
      code: data.code,
      phone: data.phone,
      email: data.email,
      address: data.address,
      showOnHeader: data.showOnHeader ?? false,
      sortOrder: Number.isFinite(data.sortOrder as number) ? (data.sortOrder as number) : 0,
    },
  })

  return NextResponse.json({ ok: true, branch: created }, { status: 201 })
}
