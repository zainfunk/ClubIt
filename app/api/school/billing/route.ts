import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: user } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()

  if (!user || user.role !== 'admin' || !user.school_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch subscription
  const { data: sub } = await db
    .from('subscriptions')
    .select('*')
    .eq('school_id', user.school_id)
    .maybeSingle()

  // Fetch recent payment events
  const { data: events } = await db
    .from('payment_events')
    .select('*')
    .eq('school_id', user.school_id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          trialEndsAt: sub.trial_ends_at,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }
      : null,
    paymentEvents: (events ?? []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      amountCents: e.amount_cents,
      currency: e.currency,
      status: e.status,
      createdAt: e.created_at,
    })),
  })
}
