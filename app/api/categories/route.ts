import { NextResponse } from 'next/server'
import { prisma } from '../../lib/db'

export async function GET() {
  const cats = await prisma.category.findMany({
    include: { variants: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(cats)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  if (!name || !name.trim()) return NextResponse.json({ error: 'name' }, { status: 400 })
  const cat = await prisma.category.create({ data: { name: name.trim() } })
  return NextResponse.json(cat, { status: 201 })
}
