// app/api/dealers/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/db'
import { requireTenantId, jsonError } from '@/app/lib/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().max(50).optional(),
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

function getId(ctx: any) {
  const raw = ctx?.params?.id
  return Array.isArray(raw) ? raw[0] : raw
}

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const tenantId = await requireTenantId()
    const id = getId(ctx)
    if (!id) return jsonError('bad_request', 400)

    const d = await prisma.dealer.findFirst({
      where: { id, tenantId },
      select: {
        id: true, name: true, code: true, phone: true, email: true, address: true,
        taxNumber: true, taxOffice: true, contactName: true, contactPhone: true,
        notes: true, isActive: true, createdAt: true, updatedAt: true,
        logoUrl: true, logoUpdatedAt: true,
      },
    })
    if (!d) return jsonError('not_found', 404)
    return Response.json({ ok: true, dealer: d })
  } catch (e: any) {
    if (e?.message === 'NO_TENANT') return jsonError('unauthorized', 401)
    return jsonError('server_error', 500)
  }
}

export async function PATCH(req: NextRequest, ctx: any) {
  try {
    const tenantId = await requireTenantId()
    const id = getId(ctx)
    if (!id) return jsonError('bad_request', 400)

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return jsonError('validation_error', 422)

    if (parsed.data.name) {
      const dup = await prisma.dealer.findFirst({
        where: { tenantId, name: parsed.data.name, NOT: { id } },
        select: { id: true },
      })
      if (dup) return jsonError('dealer_name_in_use', 409)
    }
    if (parsed.data.code) {
      const dupC = await prisma.dealer.findFirst({
        where: { tenantId, code: parsed.data.code, NOT: { id } },
        select: { id: true },
      })
      if (dupC) return jsonError('dealer_code_in_use', 409)
    }

    const res = await prisma.dealer.updateMany({
      where: { id, tenantId },
      data: parsed.data,
    })
    if (res.count === 0) return jsonError('not_found', 404)

    return Response.json({ ok: true, id })
  } catch (e: any) {
    if (e?.message === 'NO_TENANT') return jsonError('unauthorized', 401)
    return jsonError('server_error', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: any) {
  try {
    const tenantId = await requireTenantId()
    const id = getId(ctx)
    if (!id) return jsonError('bad_request', 400)

    const res = await prisma.dealer.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    })
    if (res.count === 0) return jsonError('not_found', 404)

    return Response.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'NO_TENANT') return jsonError('unauthorized', 401)
    return jsonError('server_error', 500)
  }
}
