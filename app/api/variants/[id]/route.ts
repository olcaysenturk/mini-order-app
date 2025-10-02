import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const patch = await req.json() // {name?, unitPrice?}
  const v = await prisma.variant.update({ where: { id: params.id }, data: patch })
  return NextResponse.json(v)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.variant.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
