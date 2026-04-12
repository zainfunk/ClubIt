import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

// Stripe sends raw body — disable Next.js body parsing.
export const dynamic = 'force-dynamic'

// POST — Stripe webhook. Verifies signature, then handles subscription events.
// Set STRIPE_WEBHOOK_SECRET in .env.local once you create the webhook in Stripe dashboard.
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  if (webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Stripe webhook signature verification failed:', message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    // In dev without a webhook secret, parse the event directly (NOT safe for production).
    event = JSON.parse(body) as Stripe.Event
  }

  const db = createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const schoolId = session.metadata?.schoolId
      const customerId = session.customer as string | null

      if (schoolId) {
        await db
          .from('schools')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_status: 'active',
          })
          .eq('id', schoolId)
      }
      break
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const status = subscription.status === 'active' || subscription.status === 'trialing'
        ? 'active'
        : subscription.status === 'canceled' || subscription.status === 'unpaid'
          ? 'canceled'
          : subscription.status

      await db
        .from('schools')
        .update({ stripe_subscription_status: status })
        .eq('stripe_customer_id', customerId)

      break
    }
  }

  return NextResponse.json({ received: true })
}
