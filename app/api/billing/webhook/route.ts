import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/app/lib/db'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const raw = await req.text() // dikkat: text() kullan!
  const sig = req.headers.get('stripe-signature')!
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(raw, sig, endpointSecret)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        const subId = s.subscription as string | undefined
        const customerId = s.customer as string | undefined
        if (subId && customerId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          const email = s.customer_details?.email
          if (!email) break

          const user = await prisma.user.findFirst({ where: { email } })
          if (!user) break

          await prisma.subscription.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              status: mapStripeStatus(sub.status),
              stripeCustomerId: customerId,
              stripeSubscriptionId: subId,
              stripePriceId: sub.items.data[0]?.price.id || null,
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            },
            update: {
              status: mapStripeStatus(sub.status),
              stripeCustomerId: customerId,
              stripeSubscriptionId: subId,
              stripePriceId: sub.items.data[0]?.price.id || null,
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            },
          })

          // Planı da senkronla (priceId -> Plan)
          const plan = priceIdToPlan(sub.items.data[0]?.price.id)
          if (plan) {
            await prisma.user.update({ where: { id: user.id }, data: { plan } })
          }
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } })
        if (!user) break

        await prisma.subscription.update({
          where: { userId: user.id },
          data: {
            status: mapStripeStatus(sub.status),
            stripePriceId: sub.items.data[0]?.price.id || null,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          },
        })

        const plan = priceIdToPlan(sub.items.data[0]?.price.id)
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: plan ?? 'FREE' },
        })
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('Stripe webhook error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

function mapStripeStatus(s: Stripe.Subscription.Status): any {
  // Stripe -> bizim SubStatus enum’ı
  const map: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    trialing: 'trialing',
  }
  return (map[s] as any) ?? 'inactive'
}

function priceIdToPlan(priceId?: string | null) {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO'
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'BUSINESS'
  return null
}
