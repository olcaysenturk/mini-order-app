// app/api/branches/[id]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

// PATCH body şeması
const PatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
  showOnHeader: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

/** PATCH /api/branches/[id] */
export async function PATCH(req: Request, context: any) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const id = context?.params?.id as string | undefined
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    // Kayıt var mı & tenant’a mı ait?
    const exists = await prisma.branch.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // null/undefined normalize
    const d = parsed.data
    const data: any = {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.code !== undefined ? { code: d.code || null } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.email !== undefined ? { email: d.email || null } : {}),
      ...(d.address !== undefined ? { address: d.address || null } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      ...(d.showOnHeader !== undefined ? { showOnHeader: d.showOnHeader } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
    }

    const updated = await prisma.branch.update({
      where: { id },
      data,
      select: {
        id: true, name: true, code: true, phone: true, email: true, address: true,
        isActive: true, showOnHeader: true, sortOrder: true,
      },
    })

    return NextResponse.json({ ok: true, branch: updated })
  } catch (e) {
    console.error('PATCH /branches/[id] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/** DELETE /api/branches/[id] */
export async function DELETE(_req: Request, context: any) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const id = context?.params?.id as string | undefined
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId },
      select: { id: true, showOnHeader: true, sortOrder: true },
    })
    if (!branch) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // “İlk şube” koruması
    if (branch.showOnHeader && branch.sortOrder === 0) {
      return NextResponse.json({ error: 'cannot_delete_primary_branch' }, { status: 400 })
    }

    // En az bir şube kalsın
    const total = await prisma.branch.count({ where: { tenantId } })
    if (total <= 1) {
      return NextResponse.json({ error: 'at_least_one_branch_required' }, { status: 400 })
    }

    await prisma.branch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /branches/[id] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
