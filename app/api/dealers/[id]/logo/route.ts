// app/api/dealers/[id]/logo/route.ts
import { prisma } from '@/app/lib/db'
import { requireTenantId, jsonError } from '@/app/lib/server'
import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
// (opsiyonel) cache davranışı:
export const dynamic = 'force-dynamic'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

function ensureUploadsDir() {
  const p = path.join(process.cwd(), 'public', 'uploads', 'dealers')
  return fs.mkdir(p, { recursive: true }).then(() => p)
}

// POST /api/dealers/:id/logo  (form-data: file)
export async function POST(req: Request, context: any) {
  try {
    const tenantId = await requireTenantId()

    const id = context?.params?.id as string | undefined
    if (!id) return jsonError('missing_id', 400)

    const dealer = await prisma.dealer.findFirst({
      where: { id, tenantId },
      select: { id: true, logoKey: true },
    })
    if (!dealer) return jsonError('not_found', 404)

    const fd = await req.formData()
    const file = fd.get('file') as File | null
    if (!file) return jsonError('file_missing', 400)
    if (!ALLOWED_TYPES.includes(file.type)) return jsonError('unsupported_type', 415)
    if (file.size > MAX_SIZE) return jsonError('too_large', 413)

    const buf = Buffer.from(await file.arrayBuffer())
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
    }
    const ext = extMap[file.type] || 'bin'

    const dir = await ensureUploadsDir()

    // eski dosyayı sil
    if (dealer.logoKey) {
      const oldPath = path.join(dir, dealer.logoKey)
      fs.unlink(oldPath).catch(() => {})
    }

    // yeni isim
    const key = `${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
    const full = path.join(dir, key)
    await fs.writeFile(full, buf)

    const logoUrl = `/uploads/dealers/${key}`
    await prisma.dealer.update({
      where: { id: dealer.id },
      data: { logoUrl, logoKey: key },
    })

    return NextResponse.json({ ok: true, logoUrl })
  } catch (e: any) {
    if (e?.message === 'NO_TENANT') return jsonError('unauthorized', 401)
    return jsonError('server_error', 500)
  }
}

// DELETE /api/dealers/:id/logo
export async function DELETE(_req: Request, context: any) {
  try {
    const tenantId = await requireTenantId()

    const id = context?.params?.id as string | undefined
    if (!id) return jsonError('missing_id', 400)

    const dealer = await prisma.dealer.findFirst({
      where: { id, tenantId },
      select: { id: true, logoKey: true },
    })
    if (!dealer) return jsonError('not_found', 404)

    if (dealer.logoKey) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'dealers')
      const full = path.join(dir, dealer.logoKey)
      await fs.unlink(full).catch(() => {})
    }

    await prisma.dealer.update({
      where: { id: dealer.id },
      data: { logoUrl: null, logoKey: null },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'NO_TENANT') return jsonError('unauthorized', 401)
    return jsonError('server_error', 500)
  }
}
