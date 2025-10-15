// scripts/seed-superadmin.ts
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'

const prisma = new PrismaClient()

// ---- Config (ENV ile override edilebilir) ----
const EMAIL    = process.env.SUPERADMIN_EMAIL    ?? 'olcaysenturkk@gmail.com'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? '1Qwerty!'
const USERNAME_BASE =
  process.env.SUPERADMIN_USERNAME ??
  (EMAIL.includes('@') ? EMAIL.split('@')[0] : 'superadmin')

// ---- Helpers ----
function normalize(base: string) {
  return base.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64)
}

async function getUniqueUsername(base: string) {
  const root = normalize(base)
  const exists = await prisma.user.findUnique({ where: { username: root } })
  if (!exists) return root

  for (let i = 1; i < 10_000; i++) {
    const candidate = normalize(`${root}_${i}`)
    const hit = await prisma.user.findUnique({ where: { username: candidate } })
    if (!hit) return candidate
  }
  throw new Error('Unique username could not be generated')
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  // 1) Aynı email var mı? Varsa username’i var mı?
  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, username: true, role: true },
  })

  // 2) Username’i belirle (yeni üret veya koru)
  const username =
    existing?.username && existing.username.length > 0
      ? existing.username
      : await getUniqueUsername(USERNAME_BASE)

  if (existing) {
    // 3A) Kullanıcı var: username yoksa doldur, rolü SUPERADMIN yap
    await prisma.user.update({
      where: { email: EMAIL },
      data: {
        username,                 // eksikse doldurur, varsa aynı kalır
        role: UserRole.SUPERADMIN,
        isActive: true,
      },
    })
  } else {
    // 3B) Kullanıcı yok: upsert/create
    await prisma.user.create({
      data: {
        email: EMAIL,
        name: 'Super Admin',
        username,
        passwordHash,
        role: UserRole.SUPERADMIN,
        isActive: true,
        mustChangePassword: false,
      },
    })
  }

  console.log(`✅ Superadmin hazır:
  - email:    ${EMAIL}
  - username: ${username}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed hata:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


  /**
 * Sadece SUPERADMIN’e izin verir.
 * Yetki yoksa 'FORBIDDEN' hatası fırlatır.
 * Dönüş: kullanıcı id (string)
 */
export async function requireSuperAdmin(): Promise<string> {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  const id = session?.user?.id

  if (!id || role !== 'SUPERADMIN') {
    const err = new Error('FORBIDDEN')
    ;(err as any).status = 403
    throw err
  }
  return id
}