// app/api/debug/session/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)

  let memberships = [] as any[]
  if (session?.user?.id) {
    memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      select: { tenantId: true, role: true },
    })
  }

  return Response.json({
    ok: true,
    session, // user.id, user.role, tenantId/tenantRole (JWT'den gelen)
    memberships, // DB'deki üyelikler
  })
}
