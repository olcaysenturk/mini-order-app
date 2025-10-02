// app/api/variants/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'

export const runtime = 'nodejs'

// Küçük yardımcı: Prisma 404 (P2025) kontrolü
const isPrismaP2025 = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false
  const maybe = err as { code?: unknown }
  return typeof maybe.code === 'string' && maybe.code === 'P2025'
}

/** PATCH /api/variants/:id  (name?, unitPrice?) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()

    const data: { name?: string; unitPrice?: number } = {}

    if (typeof body?.name !== 'undefined') {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
      data.name = name
    }

    if (typeof body?.unitPrice !== 'undefined') {
      const raw = body.unitPrice
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'invalid_unitPrice' }, { status: 400 })
      }
      data.unitPrice = n
    }

    if (!('name' in data) && !('unitPrice' in data)) {
      return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
    }

    const v = await prisma.variant.update({ where: { id }, data })
    return NextResponse.json(v)
  } catch (e: unknown) {
    if (isPrismaP2025(e)) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    console.error('PATCH /variants/:id error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** DELETE /api/variants/:id */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await prisma.variant.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (isPrismaP2025(e)) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    console.error('DELETE /variants/:id error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
