import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  // Verify the caller is a school admin
  const { data: user } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()

  if (!user || user.role !== 'admin' || !user.school_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const plan = body.plan as 'monthly' | 'yearly'

  if (plan !== 'monthly' && plan !== 'yearly') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const priceId = plan === 'yearly'
    ? process.env.STRIPE_YEARLY_PRICE_ID!
    : process.env.STRIPE_MONTHLY_PRICE_ID!

  // Get school info for customer creation
  const { data: school } = await db
    .from('schools')
    .select('name, contact_email')
    .eq('id', user.school_id)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }

  // Look up or create Stripe customer
  let stripeCustomerId: string | null = null

  const { data: existingSub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('school_id', user.school_id)
    .maybeSingle()

  if (existingSub?.stripe_customer_id) {
    stripeCustomerId = existingSub.stripe_customer_id
  } else {
    const customer = await getStripe().customers.create({
      email: school.contact_email,
      name: school.name,
      metadata: { school_id: user.school_id },
    })
    stripeCustomerId = customer.id
  }

  // Determine if this is a first-time subscription (offer trial)
  const isFirstSub = !existingSub

  const origin = request.headers.get('origin') || 'http://localhost:3000'

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId!,
    line_items: [{ price: priceId, quantity: 1 }],
    ...(isFirstSub ? { subscription_data: { trial_period_days: 30 } } : {}),
    success_url: `${origin}/admin/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/admin/billing`,
    metadata: { school_id: user.school_id },
  })

  return NextResponse.json({ url: session.url })
}
