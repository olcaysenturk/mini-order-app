import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/options'
import { prisma } from '@/app/lib/db'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { priceId } = await req.json() as { priceId: string }
  if (!priceId) return NextResponse.json({ error: 'price_required' }, { status: 400 })

  // Ensure Stripe customer
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.name || undefined,
    })
    customerId = customer.id
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/billing/success`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing/cancel`,
  })

  return NextResponse.json({ url: checkout.url })
}
