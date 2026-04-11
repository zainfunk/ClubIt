import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

export const dynamic = 'force-dynamic'

async function getRequester() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!userRow?.school_id) return null

  return {
    userId,
    schoolId: userRow.school_id as string,
    role: userRow.role as Role,
  }
}

const DEFAULTS = {
  achievements_enabled: true,
  attendance_enabled: true,
  clubs_enabled: true,
  student_socials_enabled: true,
}

// GET — fetch admin settings for the user's school
export async function GET() {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db
    .from('admin_settings')
    .select('achievements_enabled, attendance_enabled, clubs_enabled, student_socials_enabled')
    .eq('school_id', requester.schoolId)
    .maybeSingle()

  const row = data ?? DEFAULTS

  return NextResponse.json({
    achievementsFeatureEnabled: row.achievements_enabled ?? true,
    attendanceFeatureEnabled: row.attendance_enabled ?? true,
    clubsFeatureEnabled: row.clubs_enabled ?? true,
    studentSocialsEnabled: row.student_socials_enabled ?? true,
  })
}

// PATCH — update admin settings (admin only)
export async function PATCH(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  if (typeof body.achievementsFeatureEnabled === 'boolean') patch.achievements_enabled = body.achievementsFeatureEnabled
  if (typeof body.attendanceFeatureEnabled === 'boolean') patch.attendance_enabled = body.attendanceFeatureEnabled
  if (typeof body.clubsFeatureEnabled === 'boolean') patch.clubs_enabled = body.clubsFeatureEnabled
  if (typeof body.studentSocialsEnabled === 'boolean') patch.student_socials_enabled = body.studentSocialsEnabled

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = createServiceClient()

  const { error } = await db
    .from('admin_settings')
    .upsert(
      { ...DEFAULTS, ...patch, school_id: requester.schoolId },
      { onConflict: 'school_id' }
    )

  if (error) {
    console.error('admin settings update error', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
