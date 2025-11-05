// app/api/admin/impersonate/revert/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'
import { SignJWT } from 'jose'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.isImpersonated || !session?.impersonatorId) {
    return NextResponse.json({ error: 'not_impersonated' }, { status: 400 })
  }
  const adminId = session.impersonatorId

  // Admin kullanıcıyı doğrula
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, isActive: true, role: true },
  })
  if (!admin || !admin.isActive) {
    return NextResponse.json({ error: 'admin_not_active' }, { status: 400 })
  }

  const now = Math.floor(Date.now() / 1000)
  const jwt = await new SignJWT({
    impersonatorId: null, // geri dönüşte yok
    tenantId: null,
    scope: 'global',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(admin.id)
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(SECRET)

  // Audit close
  await prisma.impersonationLog.updateMany({
    where: {
      targetUserId: session.user?.id || undefined,
      impersonatorId: adminId,
      endedAt: null,
    },
    data: { endedAt: new Date() },
  })

  const callbackUrl = '/'
  const url = new URL(`${req.nextUrl.origin}/api/auth/callback/impersonate`)
  url.searchParams.set('token', jwt)
  url.searchParams.set('callbackUrl', callbackUrl)
  return NextResponse.json({ url: url.toString() })
}
