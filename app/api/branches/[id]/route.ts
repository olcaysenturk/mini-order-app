// app/api/branches/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

// ---- PATCH body şeması (isteğe bağlı alanlar) ----
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

/**
 * PATCH /api/branches/[id]
 * Şube alanlarını günceller (tenant scope).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const id = params.id
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
    const existing = await prisma.branch.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const updated = await prisma.branch.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json({ ok: true, branch: updated })
  } catch (e) {
    console.error('PATCH /branches/[id] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

/**
 * DELETE /api/branches/[id]
 * Şubeyi siler (tenant scope). İlk şubeyi (header+sort0) korur,
 * ayrıca sistemde en az bir şube kalmasını garanti eder.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = (session as any)?.tenantId as string | undefined
    if (!session?.user || !tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const id = params.id
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        showOnHeader: true,
        sortOrder: true,
      },
    })
    if (!branch) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // “İlk şube” koruması (UI’da da guard vardı, sunucuda da tutalım)
    if (branch.showOnHeader && branch.sortOrder === 0) {
      return NextResponse.json(
        { error: 'cannot_delete_primary_branch' },
        { status: 400 }
      )
    }

    // En az bir şube kalmalı
    const total = await prisma.branch.count({ where: { tenantId } })
    if (total <= 1) {
      return NextResponse.json(
        { error: 'at_least_one_branch_required' },
        { status: 400 }
      )
    }

    await prisma.branch.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /branches/[id] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
