// scripts/seed-superadmin.ts
import { prisma } from '@/app/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const email = 'olcaysenturkk@gmail.com'
  const passwordHash = await bcrypt.hash('supersecret', 12)

  await prisma.user.upsert({
    where: { email },
    update: { role: 'SUPERADMIN' },
    create: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'SUPERADMIN',
    },
  })
  console.log('Super admin hazır:', email)
}
main().finally(() => process.exit(0))
