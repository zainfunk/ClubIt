import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/school/attendance?clubId=…   (club-manager view)
 * GET /api/school/attendance?userId=…   (one user's records across the school)
 *
 * Service-role reads of attendance_records so they don't silently fail under
 * RLS / the unreliable Clerk->Supabase JWT bridge in the browser & iOS shell
 * (the documented failure mode behind empty streaks / 0 auto-hours). Records
 * come back camelCased (AttendanceRecord shape).
 *
 *  - clubId mode: requires the caller to be an admin/superadmin or that club's
 *    advisor (it exposes every member's hours). Also returns per-member
 *    `adjustments` (memberships.hours_adjustment_minutes) for the hours table.
 *  - userId mode: allowed when it's the caller's own records, the caller is
 *    same-school staff, or the target made attendance public — honoring
 *    user_privacy_settings server-side instead of UI-only.
 */
type RecordRow = {
  id: string
  club_id: string
  user_id: string
  meeting_date: string
  present: boolean
  duration_minutes: number | null
}

function toRecord(r: RecordRow) {
  return {
    id: r.id,
    clubId: r.club_id,
    userId: r.user_id,
    meetingDate: r.meeting_date,
    present: r.present,
    durationMinutes: r.duration_minutes ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clubId = req.nextUrl.searchParams.get('clubId')
  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!clubId && !targetUserId) {
    return NextResponse.json({ error: 'clubId or userId required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: caller } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()
  const callerSchool = (caller?.school_id as string | null) ?? null
  const callerRole = (caller?.role as Role | undefined) ?? 'student'
  if (!callerSchool) return NextResponse.json({ error: 'No school context' }, { status: 400 })

  const isStaff = callerRole === 'admin' || callerRole === 'superadmin'

  // ── clubId mode — manager view of every member's hours. ──
  if (clubId) {
    const { data: club } = await db
      .from('clubs')
      .select('school_id, advisor_id')
      .eq('id', clubId)
      .maybeSingle()
    if (!club || club.school_id !== callerSchool) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!isStaff && club.advisor_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [{ data: records }, { data: memberships }] = await Promise.all([
      db.from('attendance_records').select('id, club_id, user_id, meeting_date, present, duration_minutes').eq('club_id', clubId),
      db.from('memberships').select('user_id, hours_adjustment_minutes').eq('club_id', clubId),
    ])

    const adjustments: Record<string, number> = {}
    for (const m of memberships ?? []) {
      adjustments[m.user_id as string] = (m.hours_adjustment_minutes as number | null) ?? 0
    }

    return NextResponse.json({
      records: ((records as RecordRow[]) ?? []).map(toRecord),
      adjustments,
    })
  }

  // ── userId mode — one user's records across the caller's school. ──
  const target = targetUserId as string
  // Staff (admin/superadmin/advisor) can see any same-school student's
  // attendance, mirroring the profile UI; peers only if it's made public.
  const isSchoolStaff = isStaff || callerRole === 'advisor'
  let allowed = target === userId
  if (!allowed) {
    const [{ data: targetUser }, { data: privacy }] = await Promise.all([
      db.from('users').select('school_id').eq('id', target).maybeSingle(),
      db.from('user_privacy_settings').select('attendance_public').eq('user_id', target).maybeSingle(),
    ])
    const sameSchool = targetUser?.school_id === callerSchool
    allowed = sameSchool && (isSchoolStaff || privacy?.attendance_public === true)
  }
  if (!allowed) {
    // Not permitted to see this user's attendance — empty, not an error, so the
    // profile UI degrades gracefully (matches the UI's own visibility gating).
    return NextResponse.json({ records: [] })
  }

  const { data: records } = await db
    .from('attendance_records')
    .select('id, club_id, user_id, meeting_date, present, duration_minutes')
    .eq('user_id', target)

  return NextResponse.json({ records: ((records as RecordRow[]) ?? []).map(toRecord) })
}
