import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/school/events — every event across the caller's school clubs,
// soonest first, with the club name attached. Service-role read.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: callerRow } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()

  const schoolId = callerRow?.school_id as string | null
  if (!schoolId) {
    return NextResponse.json({ events: [] })
  }

  const { data: clubRows } = await db
    .from('clubs')
    .select('id, name, icon_url')
    .eq('school_id', schoolId)

  const clubName: Record<string, string> = {}
  const clubIcon: Record<string, string | null> = {}
  for (const c of clubRows ?? []) { clubName[c.id] = c.name; clubIcon[c.id] = c.icon_url ?? null }
  const clubIds = (clubRows ?? []).map((c) => c.id)

  if (clubIds.length === 0) {
    return NextResponse.json({ events: [] })
  }

  const { data: eventRows } = await db
    .from('events')
    .select('id, club_id, title, description, date, location, is_public, created_by')
    .in('club_id', clubIds)
    .order('date')

  const events = (eventRows ?? []).map((r) => ({
    id: r.id,
    clubId: r.club_id,
    clubName: clubName[r.club_id] ?? 'Club',
    clubIconUrl: clubIcon[r.club_id] ?? null,
    title: r.title,
    description: r.description ?? '',
    date: r.date,
    location: r.location ?? null,
    isPublic: r.is_public,
    createdBy: r.created_by,
  }))

  return NextResponse.json({ events })
}
