import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { name, unitPrice } = await req.json()
  if (!name) return NextResponse.json({ error: 'name' }, { status: 400 })
  const v = await prisma.variant.create({
    data: { name, unitPrice, categoryId: params.id },
  })
  return NextResponse.json(v, { status: 201 })
}

export const runtime = 'nodejs'