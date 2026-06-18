import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { isNativeUserAgent } from '@/lib/platform'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Apple Guideline 3.1.1: no Stripe billing management from the iOS app.
  if (isNativeUserAgent(request.headers.get('user-agent'))) {
    return NextResponse.json(
      { error: 'Billing is managed on the web at clubit.app.' },
      { status: 403 },
    )
  }

  const db = createServiceClient()

  const { data: user } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()

  if (!user || user.role !== 'admin' || !user.school_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('school_id', user.school_id)
    .maybeSingle()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  const origin = request.headers.get('origin') || 'http://localhost:3000'

  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/admin/billing`,
  })

  return NextResponse.json({ url: session.url })
}
