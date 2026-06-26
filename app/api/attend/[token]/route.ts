import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/attend/[token]
 *
 * Resolves an attendance session for the scanning student. Service-role so the
 * read can't be silently blocked by RLS in the browser/WebView (the old
 * client-side `getSessionById` failure mode that showed a valid QR as "Invalid
 * Link"). Returns the session, club display info, and the caller's eligibility.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params
  const db = createServiceClient()

  const { data: session } = await db
    .from('attendance_sessions')
    .select('*')
    .eq('id', token)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: club }, { data: user }] = await Promise.all([
    db.from('clubs').select('id, name, icon_url, school_id, advisor_id').eq('id', session.club_id).maybeSingle(),
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

  const canCheckIn = sameSchool && (isAdmin || isAdvisor || isMember)
  const recordedIds = (session.recorded_user_ids as string[] | null) ?? []

  return NextResponse.json({
    session: {
      id: session.id,
      clubId: session.club_id,
      meetingDate: session.meeting_date,
      expiresAt: session.expires_at,
      maxDistanceMeters: session.max_distance_meters,
      // Whether the advisor pinned a location (so the client knows to gather
      // geolocation). Raw coords are never sent to the client.
      requiresLocation:
        (session.max_distance_meters ?? 0) > 0 &&
        session.advisor_lat !== null &&
        session.advisor_lng !== null,
    },
    club: club ? { id: club.id, name: club.name, iconUrl: club.icon_url ?? null } : null,
    canCheckIn,
    alreadyRecorded: recordedIds.includes(userId),
  })
}
