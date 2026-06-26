import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { awardCheckInXp } from '@/lib/rewards/evaluate'
import { DEFAULT_MEETING_MINUTES } from '@/lib/rewards/hours'
import { generateRecordId } from '@/lib/schools-store'

export const dynamic = 'force-dynamic'

// Haversine distance in metres (server-side copy; the gating must not be
// trusted to the client).
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return DEFAULT_MEETING_MINUTES
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return mins
}

/**
 * POST /api/attend/[token]/check-in
 *
 * Records the calling student's attendance for a QR session. All gating
 * (eligibility, expiry, duplicate, distance) runs here on the service-role
 * client so a student can't be blocked by RLS — and can't spoof the distance.
 *
 * Body: { lat?, lng? } (required only when the session pinned a location).
 * Returns { status: 'success' | 'already' | 'expired' | 'distance' |
 *   'location-error' | 'forbidden' | 'no-session', distanceM? }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params
  const body = (await req.json().catch(() => null)) as { lat?: number; lng?: number } | null
  const db = createServiceClient()

  const { data: session } = await db
    .from('attendance_sessions')
    .select('*')
    .eq('id', token)
    .maybeSingle()

  if (!session) return NextResponse.json({ status: 'no-session' }, { status: 404 })

  const [{ data: club }, { data: user }] = await Promise.all([
    db.from('clubs').select('id, school_id, advisor_id').eq('id', session.club_id).maybeSingle(),
    db.from('users').select('school_id, role').eq('id', userId).maybeSingle(),
  ])

  const sameSchool = !!club && !!user?.school_id && club.school_id === user.school_id
  const isAdvisor = !!club && club.advisor_id === userId
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  let isMember = false
  if (sameSchool && !isAdmin && !isAdvisor) {
    const { data: m } = await db
      .from('memberships')
      .select('user_id')
      .eq('club_id', session.club_id)
      .eq('user_id', userId)
      .maybeSingle()
    isMember = !!m
  }

  if (!(sameSchool && (isAdmin || isAdvisor || isMember))) {
    return NextResponse.json({ status: 'forbidden' }, { status: 403 })
  }

  if (new Date() > new Date(session.expires_at)) {
    return NextResponse.json({ status: 'expired' })
  }

  const recordedIds = (session.recorded_user_ids as string[] | null) ?? []
  if (recordedIds.includes(userId)) {
    return NextResponse.json({ status: 'already' })
  }

  // Distance gating (server-authoritative).
  let distanceM: number | null = null
  if ((session.max_distance_meters ?? 0) > 0 && session.advisor_lat !== null && session.advisor_lng !== null) {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') {
      return NextResponse.json({ status: 'location-error' }, { status: 400 })
    }
    distanceM = Math.round(
      haversineMeters(session.advisor_lat, session.advisor_lng, body.lat, body.lng),
    )
    if (distanceM > session.max_distance_meters) {
      return NextResponse.json({ status: 'distance', distanceM })
    }
  }

  // Meeting duration from the club's scheduled meeting time (service-role read).
  let minutes = DEFAULT_MEETING_MINUTES
  const day = new Date(`${session.meeting_date}T00:00:00`).getDay()
  if (!Number.isNaN(day)) {
    const { data: mt } = await db
      .from('meeting_times')
      .select('start_time, end_time')
      .eq('club_id', session.club_id)
      .eq('day_of_week', day)
      .maybeSingle()
    if (mt) minutes = minutesBetween(mt.start_time as string, mt.end_time as string)
  }

  const { error: recErr } = await db
    .from('attendance_records')
    .upsert(
      {
        id: generateRecordId('att-dyn'),
        club_id: session.club_id,
        user_id: userId,
        meeting_date: session.meeting_date,
        present: true,
        duration_minutes: minutes,
      },
      { onConflict: 'club_id,user_id,meeting_date' },
    )

  if (recErr) {
    console.error('attend check-in: record upsert failed', recErr)
    return NextResponse.json({ error: 'Failed to record attendance. Please try again.' }, { status: 500 })
  }

  // Append to the session's recorded list (idempotent guard above).
  const { error: sessErr } = await db
    .from('attendance_sessions')
    .update({ recorded_user_ids: [...recordedIds, userId] })
    .eq('id', session.id)
  if (sessErr) console.warn('attend check-in: session update warning', sessErr)

  // Award XP / re-evaluate badges (best-effort; the attendance is already saved).
  try {
    await awardCheckInXp(userId, minutes)
  } catch (e) {
    console.error('attend check-in: xp award failed', e)
  }

  return NextResponse.json({ status: 'success', distanceM })
}
