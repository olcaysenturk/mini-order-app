// app/api/company-profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { z, ZodIssue, ZodError } from 'zod'

export const runtime = 'nodejs'

// ---- Helpers -------------------------------------------------
const toUndefIfEmpty = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v

// URL alanları: "" => undefined, sonra Zod url kontrolü
const optionalUrl = z.preprocess(
  toUndefIfEmpty,
  z
    .string()
    .trim()
    .min(1, 'Geçerli bir URL girin (örn: https://ornek.com)')
    .optional()
)

// E-posta: "" => undefined; sonra e-posta kontrolü
const optionalEmail = z.preprocess(
  toUndefIfEmpty,
  z
    .string()
    .trim()
    .email({ message: 'Geçerli bir e-posta girin (örn: mail@ornek.com)' })
    .optional()
    .nullable()
)

// Instagram: url/handle kabul; "" => undefined; çıktıyı @handle normalize et
const optionalInstagram = z.preprocess((v) => {
  if (typeof v !== 'string') return undefined
  const raw = v.trim()
  if (!raw) return undefined
  if (raw.startsWith('@')) return raw
  const handle = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
  return handle ? `@${handle}` : undefined
}, z
  .string()
  .regex(/^@[\w._-]{1,30}$/i, { message: 'Geçerli bir Instagram kullanıcı adı girin (örn: @perdekonagi)' })
  .optional()
)

const ProfileSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, 'Şirket adı zorunludur'),
  phone: z.string().trim().min(1, 'Telefon zorunludur'),
  email: z.string().trim().min(1, 'E-posta zorunludur')
            .email({ message: 'Geçerli bir e-posta girin (örn: mail@ornek.com)' }),
  address: z.string().trim().min(1, 'Adres zorunludur'),
  taxNumber: z.preprocess(toUndefIfEmpty, z.string().trim().optional().nullable()),
  taxOffice: z.preprocess(toUndefIfEmpty, z.string().trim().optional().nullable()),
  logoUrl: optionalUrl,
  website: optionalUrl,
  instagram: optionalInstagram,
})

// ZodError => okunabilir obje
function buildErrorPayload(err: ZodError) {
  // fieldErrors: { fieldName: "tek satır mesaj" }
  const fieldErrors: Record<string, string> = {}

  // issues: ham Zod hataları (path, message, code)
  const issues = err.issues.map((i: ZodIssue) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }))

  // İlk hata mesajını field’a ata
  for (const issue of err.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }

  // Alan adları yoksa genel bir fallback
  const message =
    issues.length > 0
      ? 'Bazı alanlar hatalı, lütfen kontrol edin.'
      : 'Doğrulama hatası.'

  return { error: 'validation_error', message, fieldErrors, issues }
}

// ---- GET: profili getir -------------------------------------
export async function GET() {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const profile = await prisma.companyProfile.findUnique({ where: { tenantId } })
  return NextResponse.json({ ok: true, profile })
}

// ---- PATCH: profili kaydet + ilk şubeyi garanti et/senkronla --
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const tenantId = (session as any)?.tenantId as string | undefined
  if (!session?.user || !tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const json = await req.json().catch(() => ({}))

  const parsed = ProfileSchema.safeParse(json)
  if (!parsed.success) {
    const payload = buildErrorPayload(parsed.error)
    return NextResponse.json(payload, { status: 422 })
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
    orderBy: { createdAt: 'asc' },
  })

  if (!firstBranch) {
    await prisma.branch.create({
      data: {
        tenantId,
        name: profile.companyName,
        phone: profile.phone || null,
        email: profile.email || null,
        address: profile.address || null,
        code: 'MERKEZ',
        showOnHeader: true,
        sortOrder: 0,
        isActive: true,
      },
    })
  } else {
    await prisma.branch.update({
      where: { id: firstBranch.id },
      data: {
        name: profile.companyName,
        phone: profile.phone || null,
        email: profile.email || null,
        address: profile.address || null,
      },
    })
  }

  return NextResponse.json({ ok: true, profile })
}
