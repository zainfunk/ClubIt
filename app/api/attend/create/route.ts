import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateRecordId } from '@/lib/schools-store'

export const dynamic = 'force-dynamic'

/**
 * POST /api/attend/create
 *
 * An advisor/admin starts an attendance session (the target a QR code points
 * at). Runs through the service-role client so the write can't be silently
 * dropped by RLS in the browser (the old client-side `saveSession` failure mode
 * that left QR codes pointing at non-existent sessions — "Invalid Link").
 *
 * Body: { clubId, meetingDate, expiryMinutes?, maxDistanceMeters?, advisorLat?, advisorLng? }
 * Returns the created session so the client can render the QR.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    clubId?: string
    meetingDate?: string
    expiryMinutes?: number
    maxDistanceMeters?: number
    advisorLat?: number
    advisorLng?: number
  } | null

  if (!body?.clubId || !body.meetingDate) {
    return NextResponse.json({ error: 'clubId and meetingDate are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const [{ data: club }, { data: user }] = await Promise.all([
    db.from('clubs').select('id, school_id, advisor_id').eq('id', body.clubId).maybeSingle(),
    db.from('users').select('school_id, role').eq('id', userId).maybeSingle(),
  ])

  if (!club || !user?.school_id || club.school_id !== user.school_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isManager =
    user.role === 'admin' || user.role === 'superadmin' || club.advisor_id === userId
  if (!isManager) {
    return NextResponse.json(
      { error: 'Only the club advisor or an admin can start attendance.' },
      { status: 403 },
    )
  }

  const expiryMinutes =
    typeof body.expiryMinutes === 'number' && body.expiryMinutes > 0 ? body.expiryMinutes : 60
  const maxDistanceMeters =
    typeof body.maxDistanceMeters === 'number' && body.maxDistanceMeters >= 0
      ? body.maxDistanceMeters
      : 0
  const id = generateRecordId('sess')
  const expiresAt = new Date(Date.now() + expiryMinutes * 60_000).toISOString()
  const advisorLat = typeof body.advisorLat === 'number' ? body.advisorLat : null
  const advisorLng = typeof body.advisorLng === 'number' ? body.advisorLng : null

  const { error } = await db.from('attendance_sessions').insert({
    id,
    club_id: club.id,
    meeting_date: body.meetingDate,
    created_by: userId,
    expires_at: expiresAt,
    max_distance_meters: maxDistanceMeters,
    advisor_lat: advisorLat,
    advisor_lng: advisorLng,
    recorded_user_ids: [],
  })

  if (error) {
    console.error('attend/create: insert failed', error)
    return NextResponse.json({ error: 'Failed to start attendance. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({
    id,
    clubId: club.id,
    meetingDate: body.meetingDate,
    createdBy: userId,
    expiresAt,
    maxDistanceMeters,
    advisorLat: advisorLat ?? undefined,
    advisorLng: advisorLng ?? undefined,
    recordedUserIds: [],
  })
}
