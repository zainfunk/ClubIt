import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

// POST — create a Stripe Checkout Session for the $500/year school subscription.
// Requires authentication. Associates the session with the caller's school.
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, email, name, role')
    .eq('id', userId)
    .maybeSingle()

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'ClubIt for Schools',
            description: 'Unlimited clubs, students, and teachers. Mobile + web. Annual plan.',
          },
          unit_amount: 50000,
          recurring: { interval: 'year' },
        },
        quantity: 1,
      },
    ],
    customer_email: userRow?.email ?? undefined,
    metadata: {
      userId,
      schoolId: userRow?.school_id ?? '',
    },
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/landing?checkout=cancelled`,
  })

  return NextResponse.json({ url: session.url })
}
