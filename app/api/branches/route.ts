import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

const CreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().max(50).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  showOnHeader: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'
  const q = (searchParams.get('q') || '').trim()

  const where = {
    tenantId,
    ...(all ? {} : { isActive: true }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const json = await req.json().catch(() => ({}))
  const parsed = CreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 422 })
  }

  // unique name per tenant
  const dup = await prisma.branch.findFirst({ where: { tenantId, name: parsed.data.name }, select: { id: true } })
  if (dup) return NextResponse.json({ error: 'branch_name_in_use' }, { status: 409 })

  const created = await prisma.branch.create({
    data: { tenantId, ...parsed.data },
  })
  return NextResponse.json({ ok: true, branch: created }, { status: 201 })
}
