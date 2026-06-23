import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { PrivacyPatchSchema, badRequest } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  achievements_public: true,
  attendance_public: false,
  clubs_public: true,
}

// GET — fetch privacy settings for the current user. Scoping is enforced by the
// application-level eq('user_id', userId) filter on the service client.
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

  const parsed = PrivacyPatchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error.issues), { status: 400 })
  }
  const patch: Record<string, unknown> = {}
  if (parsed.data.achievementsPublic !== undefined) patch.achievements_public = parsed.data.achievementsPublic
  if (parsed.data.attendancePublic !== undefined)   patch.attendance_public   = parsed.data.attendancePublic
  if (parsed.data.clubsPublic !== undefined)        patch.clubs_public        = parsed.data.clubsPublic

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
