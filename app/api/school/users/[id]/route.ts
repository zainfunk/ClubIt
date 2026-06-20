import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Club, LeadershipPosition, Role, User } from '@/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

type ClubRow = {
  id: string
  name: string
  description?: string | null
  icon_url?: string | null
  capacity?: number | null
  advisor_id?: string | null
  tags?: string[] | null
  event_creator_ids?: string[] | null
  auto_accept?: boolean | null
  dues_amount_cents?: number | null
  created_at?: string | null
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

// GET /api/school/users/[id] — one user in the caller's school, with the clubs
// they belong to and (if staff) advise. Service-role read; used by the web
// profile page and the mobile student profile so they resolve reliably.
export async function GET(_request: NextRequest, { params }: PageProps) {
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
    return NextResponse.json({ user: null, memberClubs: [], advisingClubs: [], usersById: {} })
  }

  const { id: targetId } = await params

  const [{ data: targetRow }, { data: overrideRow }] = await Promise.all([
    db.from('users').select('id, name, email, role, school_id, avatar_url').eq('id', targetId).maybeSingle(),
    db.from('user_overrides').select('user_id, name, email').eq('user_id', targetId).maybeSingle(),
  ])

  // Only expose users in the caller's school.
  if (!targetRow || targetRow.school_id !== schoolId) {
    return NextResponse.json({ user: null, memberClubs: [], advisingClubs: [], usersById: {} }, { status: 404 })
  }

  const user: User = {
    id: targetRow.id,
    name: overrideRow?.name?.trim() || targetRow.name,
    email: overrideRow?.email?.trim() || targetRow.email,
    role: targetRow.role as Role,
    avatarUrl: targetRow.avatar_url ?? undefined,
    schoolId: targetRow.school_id ?? undefined,
  }

  // Clubs the user is a member of + clubs they advise.
  const [{ data: myMemberships }, { data: advisingRows }] = await Promise.all([
    db.from('memberships').select('club_id').eq('user_id', targetId),
    db.from('clubs').select('id, name, description, icon_url, capacity, advisor_id, tags, event_creator_ids, auto_accept, dues_amount_cents, created_at').eq('school_id', schoolId).eq('advisor_id', targetId),
  ])

  const memberClubIds = unique((myMemberships ?? []).map((m) => m.club_id as string))

  const { data: memberClubRows } = memberClubIds.length > 0
    ? await db.from('clubs').select('id, name, description, icon_url, capacity, advisor_id, tags, event_creator_ids, auto_accept, dues_amount_cents, created_at').in('id', memberClubIds)
    : { data: [] as ClubRow[] }

  const allClubRows = [...(memberClubRows ?? []), ...(advisingRows ?? [])] as ClubRow[]
  const allClubIds = unique(allClubRows.map((c) => c.id))

  // Enrich with memberships + leadership across all involved clubs.
  const [{ data: memberships }, { data: leadership }] = await Promise.all([
    allClubIds.length > 0
      ? db.from('memberships').select('club_id, user_id').in('club_id', allClubIds)
      : Promise.resolve({ data: [] as { club_id: string; user_id: string }[] }),
    allClubIds.length > 0
      ? db.from('leadership_positions').select('id, club_id, title, user_id').in('club_id', allClubIds)
      : Promise.resolve({ data: [] as { id: string; club_id: string; title: string; user_id: string | null }[] }),
  ])

  const memberIdsByClub: Record<string, string[]> = {}
  for (const m of memberships ?? []) {
    ;(memberIdsByClub[m.club_id] ??= []).push(m.user_id)
  }
  const leadershipByClub: Record<string, LeadershipPosition[]> = {}
  for (const lp of leadership ?? []) {
    ;(leadershipByClub[lp.club_id] ??= []).push({ id: lp.id, title: lp.title, userId: lp.user_id ?? undefined })
  }

  function mapClub(row: ClubRow): Club {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      iconUrl: row.icon_url ?? undefined,
      capacity: row.capacity ?? null,
      advisorId: row.advisor_id ?? '',
      memberIds: memberIdsByClub[row.id] ?? [],
      eventCreatorIds: row.event_creator_ids ?? [],
      leadershipPositions: leadershipByClub[row.id] ?? [],
      socialLinks: [],
      meetingTimes: [],
      tags: row.tags ?? [],
      createdAt: row.created_at ?? '',
      autoAccept: row.auto_accept ?? false,
      duesAmountCents: row.dues_amount_cents ?? 0,
    }
  }

  const memberClubs = (memberClubRows ?? []).map((r) => mapClub(r as ClubRow))
  const advisingClubs = (advisingRows ?? []).map((r) => mapClub(r as ClubRow))

  // Resolve related users (advisors of member clubs, members of advised clubs)
  // so callers can render names without another round-trip.
  const relatedUserIds = unique([
    user.id,
    ...allClubRows.map((c) => c.advisor_id ?? ''),
    ...advisingClubs.flatMap((c) => c.memberIds),
  ].filter(Boolean))

  const usersById: Record<string, User> = {}
  if (relatedUserIds.length > 0) {
    const [{ data: relUsers }, { data: relOverrides }] = await Promise.all([
      db.from('users').select('id, name, email, role, school_id, avatar_url').in('id', relatedUserIds),
      db.from('user_overrides').select('user_id, name, email').in('user_id', relatedUserIds),
    ])
    const ovr: Record<string, { name?: string | null; email?: string | null }> = {}
    for (const row of relOverrides ?? []) ovr[row.user_id] = row
    for (const row of relUsers ?? []) {
      const o = ovr[row.id]
      usersById[row.id] = {
        id: row.id,
        name: o?.name?.trim() || row.name,
        email: o?.email?.trim() || row.email,
        role: row.role as Role,
        avatarUrl: row.avatar_url ?? undefined,
        schoolId: row.school_id ?? undefined,
      }
    }
  }

  return NextResponse.json({ user, memberClubs, advisingClubs, usersById })
}
