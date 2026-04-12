import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(db, event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(db, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(db, event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(db, event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(db, event.data.object as Stripe.Subscription)
        break
    }

    await logPaymentEvent(db, event)
  } catch (err) {
    console.error(`Stripe webhook handler error for ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------------------
// Helpers for Stripe v22+ type changes
// ---------------------------------------------------------------------------

/** Extract subscription ID from an Invoice (v22: nested under parent.subscription_details) */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription
  if (!sub) return null
  return typeof sub === 'string' ? sub : sub.id
}

/** Get current period timestamps from a subscription's first item */
function getItemPeriod(sub: Stripe.Subscription) {
  const item = sub.items.data[0]
  return {
    start: item ? new Date(item.current_period_start * 1000).toISOString() : null,
    end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  db: SupabaseClient,
  session: Stripe.Checkout.Session,
) {
  const schoolId = session.metadata?.school_id
  if (!schoolId || session.mode !== 'subscription') return

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id

  if (!subscriptionId) return

  // Fetch the full subscription from Stripe to get period details
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ['items.data'],
  })

  const plan = determinePlan(sub)
  const period = getItemPeriod(sub)

  await db.from('subscriptions').upsert(
    {
      school_id: schoolId,
      stripe_customer_id: typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id ?? '',
      stripe_subscription_id: sub.id,
      plan,
      status: sub.status === 'trialing' ? 'trialing' : 'active',
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'school_id' },
  )

  // Ensure school is active
  await db.from('schools').update({ status: 'active' }).eq('id', schoolId)
}

async function handlePaymentSucceeded(
  db: SupabaseClient,
  invoice: Stripe.Invoice,
) {
  const subId = getSubscriptionIdFromInvoice(invoice)
  if (!subId) return

  const { data: subRow } = await db
    .from('subscriptions')
    .select('school_id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle()

  if (!subRow) return

  // Update subscription status to active
  await db
    .from('subscriptions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subId)

  // Reactivate school if it was paused due to payment failure
  const { data: school } = await db
    .from('schools')
    .select('status')
    .eq('id', subRow.school_id)
    .maybeSingle()

  if (school?.status === 'payment_paused') {
    await db.from('schools').update({ status: 'active' }).eq('id', subRow.school_id)

    await notifySchoolAdmins(db, subRow.school_id, {
      type: 'payment_success',
      title: 'Payment successful',
      body: 'Your school has been reactivated. Thank you for your payment!',
    })
  }
}

async function handlePaymentFailed(
  db: SupabaseClient,
  invoice: Stripe.Invoice,
) {
  const subId = getSubscriptionIdFromInvoice(invoice)
  if (!subId) return

  const { data: subRow } = await db
    .from('subscriptions')
    .select('school_id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle()

  if (!subRow) return

  // Update subscription to past_due
  await db
    .from('subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subId)

  // If all retries are exhausted, pause the school
  if (!invoice.next_payment_attempt) {
    await db
      .from('subscriptions')
      .update({ status: 'unpaid', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subId)

    await db
      .from('schools')
      .update({ status: 'payment_paused' })
      .eq('id', subRow.school_id)

    await notifySchoolAdmins(db, subRow.school_id, {
      type: 'payment_paused',
      title: 'School paused — payment failed',
      body: 'Your school has been temporarily paused because we could not process your payment. Please update your payment method to restore access.',
    })
  } else {
    await notifySchoolAdmins(db, subRow.school_id, {
      type: 'payment_failed',
      title: 'Payment failed',
      body: 'We were unable to process your subscription payment. We will retry automatically. Please update your payment method if needed.',
    })
  }
}

async function handleSubscriptionUpdated(
  db: SupabaseClient,
  sub: Stripe.Subscription,
) {
  const plan = determinePlan(sub)
  const period = getItemPeriod(sub)

  const statusMap: Record<string, string> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    paused: 'paused',
  }

  await db
    .from('subscriptions')
    .update({
      plan,
      status: statusMap[sub.status] ?? sub.status,
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', sub.id)
}

async function handleSubscriptionDeleted(
  db: SupabaseClient,
  sub: Stripe.Subscription,
) {
  const { data: subRow } = await db
    .from('subscriptions')
    .select('school_id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()

  if (!subRow) return

  await db
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id)

  await db
    .from('schools')
    .update({ status: 'payment_paused' })
    .eq('id', subRow.school_id)

  await notifySchoolAdmins(db, subRow.school_id, {
    type: 'subscription_canceled',
    title: 'Subscription canceled',
    body: 'Your school subscription has been canceled and access has been paused. Subscribe again to restore access.',
  })
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function determinePlan(sub: Stripe.Subscription): 'monthly' | 'yearly' {
  const interval = sub.items.data[0]?.price?.recurring?.interval
  return interval === 'year' ? 'yearly' : 'monthly'
}

async function logPaymentEvent(db: SupabaseClient, event: Stripe.Event) {
  let schoolId: string | null = null
  let amountCents: number | null = null
  let status = 'unknown'

  if (event.type.startsWith('invoice.')) {
    const invoice = event.data.object as Stripe.Invoice
    amountCents = invoice.amount_due
    status = event.type === 'invoice.payment_succeeded' ? 'succeeded' : 'failed'

    const subId = getSubscriptionIdFromInvoice(invoice)
    if (subId) {
      const { data } = await db
        .from('subscriptions')
        .select('school_id')
        .eq('stripe_subscription_id', subId)
        .maybeSingle()
      schoolId = data?.school_id ?? null
    }
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    schoolId = session.metadata?.school_id ?? null
    status = 'succeeded'
    amountCents = session.amount_total
  } else if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription
    status = sub.status
    const { data } = await db
      .from('subscriptions')
      .select('school_id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle()
    schoolId = data?.school_id ?? null
  }

  // Upsert to handle duplicate webhook deliveries
  await db.from('payment_events').upsert(
    {
      school_id: schoolId,
      stripe_event_id: event.id,
      event_type: event.type,
      amount_cents: amountCents,
      currency: 'usd',
      status,
      metadata: { livemode: event.livemode },
      created_at: new Date(event.created * 1000).toISOString(),
    },
    { onConflict: 'stripe_event_id' },
  )
}

async function notifySchoolAdmins(
  db: SupabaseClient,
  schoolId: string,
  notification: { type: string; title: string; body: string },
) {
  const { data: admins } = await db
    .from('users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'admin')

  if (!admins?.length) return

  const rows = admins.map((admin) => ({
    user_id: admin.id,
    school_id: schoolId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: '/admin/billing',
  }))

  await db.from('notifications').insert(rows)
}
