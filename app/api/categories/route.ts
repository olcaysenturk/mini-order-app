// app/api/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

const CreateSchema = z.object({
  name: z.string().trim().min(1),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined

  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const categories = await prisma.category.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: { variants: true },
  })
  return NextResponse.json(categories)
}

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

  const created = await prisma.category.create({
    data: {
      tenantId,
      name: parsed.data.name,
    },
  })
  return NextResponse.json(created, { status: 201 })
}
