import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushToUsers, pushConfigured } from '@/lib/push-send'

export const dynamic = 'force-dynamic'

/**
 * Event reminder cron (App Store Guideline 4.2 native push).
 *
 * Sends a "happening soon" APNs push for every club event starting within the
 * next 24h that hasn't been reminded yet, then stamps `reminder_sent_at` so each
 * event fires at most once. Scheduled hourly by `vercel.json`.
 *
 * Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`
 * when the env var is set. If CRON_SECRET is unset the endpoint refuses to run
 * (so it can't be hit anonymously). Dormant-safe: no-ops cleanly until APNs is
 * configured, so it never errors in prod before the Apple key exists.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'push-not-configured', reminded: 0 })
  }

  const db = createServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const in24hIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  // events.date is ISO text; lexical range == chronological range.
  const { data: dueEvents, error } = await db
    .from('events')
    .select('id, club_id, title, date')
    .is('reminder_sent_at', null)
    .gte('date', nowIso)
    .lte('date', in24hIso)

  if (error) {
    console.error('[cron] event-reminders query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
  if (!dueEvents || dueEvents.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 })
  }

  let reminded = 0
  for (const ev of dueEvents) {
    const clubId = ev.club_id as string
    const [{ data: club }, { data: members }] = await Promise.all([
      db.from('clubs').select('name, advisor_id').eq('id', clubId).maybeSingle(),
      db.from('memberships').select('user_id').eq('club_id', clubId),
    ])

    const recipients = new Set<string>()
    for (const m of members ?? []) recipients.add(m.user_id as string)
    if (club?.advisor_id) recipients.add(club.advisor_id as string)

    if (recipients.size > 0) {
      await sendPushToUsers(Array.from(recipients), {
        title: `Reminder · ${club?.name ?? 'Your club'}`,
        body: `${ev.title} is coming up`,
        path: `/clubs/${clubId}`,
      })
    }

    // Stamp regardless of recipient count so an event without members isn't
    // re-scanned every hour.
    await db.from('events').update({ reminder_sent_at: nowIso }).eq('id', ev.id)
    reminded++
  }

  return NextResponse.json({ ok: true, reminded })
}
