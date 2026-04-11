import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  achievements_public: true,
  attendance_public: false,
  clubs_public: true,
}

// GET — fetch privacy settings for the current user
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db
    .from('user_privacy_settings')
    .select('achievements_public, attendance_public, clubs_public')
    .eq('user_id', userId)
    .maybeSingle()

  const row = data ?? DEFAULTS

  return NextResponse.json({
    achievementsPublic: row.achievements_public ?? true,
    attendancePublic: row.attendance_public ?? false,
    clubsPublic: row.clubs_public ?? true,
  })
}

// PATCH — update privacy settings for the current user
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  if (typeof body.achievementsPublic === 'boolean') patch.achievements_public = body.achievementsPublic
  if (typeof body.attendancePublic === 'boolean') patch.attendance_public = body.attendancePublic
  if (typeof body.clubsPublic === 'boolean') patch.clubs_public = body.clubsPublic

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = createServiceClient()

  const { error } = await db
    .from('user_privacy_settings')
    .upsert(
      { ...DEFAULTS, ...patch, user_id: userId },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('user privacy update error', error)
    return NextResponse.json({ error: 'Failed to save privacy settings' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
