// app/api/billing/portal/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options' // ← düzeltildi
import { prisma } from '@/app/lib/db'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id as string
  const user = await prisma.user.findUnique({ where: { id: userId } })

//   if (!user?.stripeCustomerId || 0) {
//     return NextResponse.json({ error: 'no_customer' }, { status: 400 })
//   }

//   const portal = await stripe.billingPortal.sessions.create({
//     customer: user.stripeCustomerId,
//     return_url: `${process.env.NEXTAUTH_URL}/settings/billing`,
//   })

  return NextResponse.json({ url: "/" })
}
