// app/lib/server.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'

export function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status })
}

export class HttpError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function requireTenantId(): Promise<string> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  const role = session?.user?.role

  if (!userId) throw new HttpError('NO_TENANT', 401)

  // 1) Token’dan gelen tenantId varsa direkt dön
  const tokenTenantId = (session as any)?.tenantId as string | null | undefined
  if (tokenTenantId) return tokenTenantId

  // 2) Normal kullanıcı ise: üyelikten seç
  if (role !== 'SUPERADMIN') {
    const mem = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true },
    })
    if (!mem) throw new HttpError('NO_TENANT', 401)
    return mem.tenantId
  }

  // 3) SUPERADMIN: Var olan ilk tenant’a OWNER olarak ekle
  const anyTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (anyTenant) {
    await prisma.membership.upsert({
      where: { userId_tenantId: { userId, tenantId: anyTenant.id } },
      update: { role: 'OWNER' },
      create: { userId, tenantId: anyTenant.id, role: 'OWNER' },
    })
    return anyTenant.id
  }

  // 4) Hiç tenant yoksa otomatik oluştur (tenant + OWNER + “Merkez” şubesi)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })
  const workspaceName = `${user?.name || 'Admin'}'s workspace`

  const { tenant } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: workspaceName, createdById: userId },
    })
    await tx.membership.create({
      data: { userId, tenantId: tenant.id, role: 'OWNER' },
    })
    await tx.branch.create({
      data: { tenantId: tenant.id, name: 'Merkez', isActive: true },
    })
    return { tenant }
  })

  return tenant.id
}
