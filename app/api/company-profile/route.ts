import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

// "" → undefined kabul eden opsiyonel URL
const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().url().optional()
)

// "@handle" normalizasyonu (url/handle fark etmez)
const optionalInstagram = z.preprocess((v) => {
  if (typeof v !== 'string') return undefined
  const raw = v.trim()
  if (!raw) return undefined
  if (raw.startsWith('@')) return raw
  const handle = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
  return handle ? `@${handle}` : undefined
}, z.string().optional())

const ProfileSchema = z.object({
  companyName: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  taxNumber: z.string().trim().optional().nullable(),
  taxOffice: z.string().trim().optional().nullable(),
  logoUrl: optionalUrl,   // "" kabul
  website: optionalUrl,   // "" kabul
  instagram: optionalInstagram, // "" kabul; url/handle -> @handle
})

// GET: profili getir
export async function GET() {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const profile = await prisma.companyProfile.findUnique({
    where: { tenantId },
  })

  return NextResponse.json({ ok: true, profile })
}

// PATCH: profili kaydet + ilk şubeyi garanti et/senkronla
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const json = await req.json().catch(() => ({}))
  const parsed = ProfileSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const data = parsed.data

  // profil upsert
  const profile = await prisma.companyProfile.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: { ...data },
  })

  // === İLK ŞUBE LOJİĞİ ===
  // Kural: showOnHeader=true && sortOrder=0 olan şube "ilk şube"
  const firstBranch = await prisma.branch.findFirst({
    where: { tenantId, showOnHeader: true, sortOrder: 0 },
    orderBy: { createdAt: 'asc' }, // olası birden fazla durumunda en eskisini baz al
  })

  if (!firstBranch) {
    // tenant'ın hiç şubesi yoksa mı bakalım? aslında kontrol etmeye gerek yok;
    // "ilk şube" yoksa profilden bir tane oluşturuyoruz.
    await prisma.branch.create({
      data: {
        tenantId,
        name: profile.companyName,
        phone: profile.phone || null,
        email: profile.email || null,
        address: profile.address || null,
        code: 'MAIN',           // opsiyonel: kısa kod
        showOnHeader: true,
        sortOrder: 0,
        isActive: true,
      },
    })
  } else {
    // "ilk şube" varsa profilin ana alanlarıyla senkron tut
    await prisma.branch.update({
      where: { id: firstBranch.id },
      data: {
        name: profile.companyName,
        phone: profile.phone || null,
        email: profile.email || null,
        address: profile.address || null,
        // showOnHeader + sortOrder'ı sabit bırakıyoruz (ilk şube kriteri)
      },
    })
  }

  return NextResponse.json({ ok: true, profile })
}
