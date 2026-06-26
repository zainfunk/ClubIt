import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_MEETING_MINUTES } from '@/lib/rewards/hours'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { userId: caller } = await auth()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = request.nextUrl.searchParams.get('userId') ?? caller
  const db = createServiceClient()

  // IDOR + privacy gate: only the caller, same-school staff, or a target who
  // made attendance public may read someone else's hours. Otherwise return
  // zeros (not an error) so the profile UI degrades gracefully.
  if (userId !== caller) {
    const [{ data: targetUser }, { data: callerRow }, { data: privacy }] = await Promise.all([
      db.from('users').select('school_id').eq('id', userId).maybeSingle(),
      db.from('users').select('school_id, role').eq('id', caller).maybeSingle(),
      db.from('user_privacy_settings').select('attendance_public').eq('user_id', userId).maybeSingle(),
    ])
    const sameSchool = !!targetUser?.school_id && targetUser.school_id === callerRow?.school_id
    const isStaff =
      callerRow?.role === 'admin' || callerRow?.role === 'superadmin' || callerRow?.role === 'advisor'
    if (!sameSchool || !(isStaff || privacy?.attendance_public === true)) {
      return NextResponse.json({ autoMinutes: 0, adjustmentMinutes: 0, totalMinutes: 0 })
    }
  }

  const [attRes, memRes] = await Promise.all([
    db.from('attendance_records').select('duration_minutes').eq('user_id', userId).eq('present', true),
    db.from('memberships').select('hours_adjustment_minutes').eq('user_id', userId),
  ])

  const autoMinutes = (attRes.data ?? []).reduce(
    (sum, r) => sum + ((r.duration_minutes as number | null) ?? DEFAULT_MEETING_MINUTES),
    0,
  )
  const adjustmentMinutes = (memRes.data ?? []).reduce(
    (sum, r) => sum + ((r.hours_adjustment_minutes as number | null) ?? 0),
    0,
  )

  return NextResponse.json({
    autoMinutes,
    adjustmentMinutes,
    totalMinutes: Math.max(0, autoMinutes + adjustmentMinutes),
  })
}
