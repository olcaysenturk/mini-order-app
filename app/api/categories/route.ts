// app/api/categories/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId

  const categories = await prisma.category.findMany({
    where: { tenantId },
    include: { variants: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId

  const { name } = await req.json()
  const cat = await prisma.category.create({
    data: { tenantId, name: String(name).trim() },
  })
  return NextResponse.json(cat, { status: 201 })
}
