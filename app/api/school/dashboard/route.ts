import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  // Look up the user's role and school
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role, name, xp_total')
    .eq('id', userId)
    .maybeSingle()

  if (!userRow?.school_id) {
    return NextResponse.json({
      clubs: [],
      advisorNames: {},
      myMembershipClubIds: [],
      pinnedNews: {},
      nextEvents: {},
      pendingRequests: [],
      pendingApprovals: [],
      issueReports: [],
      xpTotal: 0,
    })
  }

  const schoolId = userRow.school_id
  const role = userRow.role as string

  // Fetch all clubs in school
  const { data: clubRows } = await db
    .from('clubs')
    .select('id, name, description, icon_url, capacity, advisor_id, auto_accept, tags, event_creator_ids, created_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  const allClubs = clubRows ?? []
  const clubIds = allClubs.map((c) => c.id)

  // Parallel fetches
  const advisorIds = [...new Set(allClubs.map((c) => c.advisor_id).filter(Boolean))]
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: memberships },
    { data: advisorRows },
    { data: newsRows },
    { data: eventRows },
    { data: joinRequestRows },
    { data: issueRows },
  ] = await Promise.all([
    clubIds.length > 0
      ? db.from('memberships').select('club_id, user_id').in('club_id', clubIds)
      : Promise.resolve({ data: [] as { club_id: string; user_id: string }[] }),
    advisorIds.length > 0
      ? db.from('users').select('id, name').in('id', advisorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    clubIds.length > 0
      ? db.from('club_news').select('*').in('club_id', clubIds).eq('is_pinned', true)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    clubIds.length > 0
      ? db.from('events').select('*').in('club_id', clubIds).gte('date', today).order('date')
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    role === 'student'
      ? db.from('join_requests').select('*').eq('user_id', userId).eq('status', 'pending')
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    role === 'advisor'
      ? db.from('issue_reports').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  // Build memberIds map
  const memberIdsByClub: Record<string, string[]> = {}
  for (const m of memberships ?? []) {
    if (!memberIdsByClub[m.club_id]) memberIdsByClub[m.club_id] = []
    memberIdsByClub[m.club_id].push(m.user_id)
  }

  // Build advisor name map
  const advisorNames: Record<string, string> = {}
  for (const a of advisorRows ?? []) {
    advisorNames[a.id] = a.name
  }

  // Filter clubs for this user
  const myMembershipClubIds = (memberships ?? [])
    .filter((m) => m.user_id === userId)
    .map((m) => m.club_id)

  let myClubs
  if (role === 'student') {
    myClubs = allClubs.filter((c) => myMembershipClubIds.includes(c.id))
  } else if (role === 'advisor') {
    myClubs = allClubs.filter((c) => c.advisor_id === userId)
  } else {
    myClubs = allClubs
  }

  const myClubIds = myClubs.map((c) => c.id)

  // Pinned news — one per club, most recent
  const pinnedNews: Record<string, Record<string, unknown>> = {}
  for (const n of newsRows ?? []) {
    const r = n as Record<string, unknown>
    const clubId = r.club_id as string
    if (!myClubIds.includes(clubId)) continue
    const existing = pinnedNews[clubId]
    if (!existing || new Date(r.created_at as string) > new Date(existing.createdAt as string)) {
      pinnedNews[clubId] = {
        id: r.id, clubId: r.club_id, title: r.title, content: r.content,
        authorId: r.author_id, createdAt: r.created_at, isPinned: r.is_pinned,
      }
    }
  }

  // Next upcoming event per club
  const nextEvents: Record<string, Record<string, unknown>> = {}
  for (const e of eventRows ?? []) {
    const r = e as Record<string, unknown>
    const clubId = r.club_id as string
    if (!myClubIds.includes(clubId)) continue
    if (!nextEvents[clubId]) {
      nextEvents[clubId] = {
        id: r.id, clubId: r.club_id, title: r.title, description: r.description ?? '',
        date: r.date, location: r.location ?? undefined, isPublic: r.is_public, createdBy: r.created_by,
      }
    }
  }

  // Map clubs to the expected shape
  const clubs = myClubs.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    iconUrl: row.icon_url ?? undefined,
    capacity: row.capacity,
    advisorId: row.advisor_id ?? '',
    memberIds: memberIdsByClub[row.id] ?? [],
    leadershipPositions: [],
    socialLinks: [],
    meetingTimes: [],
    tags: row.tags ?? [],
    eventCreatorIds: row.event_creator_ids ?? [],
    createdAt: row.created_at,
    autoAccept: row.auto_accept ?? false,
  }))

  // Pending join requests — include club name for display
  const pendingRequests = (joinRequestRows ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const clubRow = allClubs.find((c) => c.id === row.club_id)
    return {
      id: row.id, clubId: row.club_id, userId: row.user_id,
      requestedAt: row.requested_at, status: row.status,
      clubName: clubRow?.name ?? 'Unknown Club',
      clubIcon: clubRow?.icon_url ?? undefined,
    }
  })

  // Pending approvals — join requests an advisor/admin can action, across the
  // clubs they manage (advisor: own clubs; admin: all school clubs).
  let pendingApprovals: { id: string; clubId: string; clubName: string; userId: string; userName: string }[] = []
  if (role === 'advisor' || role === 'admin' || role === 'superadmin') {
    const manageIds = myClubIds
    if (manageIds.length > 0) {
      const { data: approvalRows } = await db
        .from('join_requests')
        .select('id, club_id, user_id, requested_at')
        .in('club_id', manageIds)
        .eq('status', 'pending')

      const requesterIds = [...new Set((approvalRows ?? []).map((r) => r.user_id as string))]
      const nameById: Record<string, string> = {}
      if (requesterIds.length > 0) {
        const { data: requesterRows } = await db
          .from('users')
          .select('id, name')
          .in('id', requesterIds)
        for (const u of requesterRows ?? []) nameById[u.id] = u.name
      }

      pendingApprovals = (approvalRows ?? []).map((r) => {
        const clubRow = allClubs.find((c) => c.id === r.club_id)
        return {
          id: r.id,
          clubId: r.club_id,
          clubName: clubRow?.name ?? 'Club',
          userId: r.user_id,
          userName: nameById[r.user_id] ?? 'Student',
        }
      })
    }
  }

  // Issue reports
  const issueReports = (issueRows ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: row.id, reporter_name: row.reporter_name, reporter_email: row.reporter_email,
      message: row.message, status: row.status, created_at: row.created_at,
    }
  })

  return NextResponse.json({
    clubs,
    advisorNames,
    myMembershipClubIds,
    pinnedNews,
    nextEvents,
    pendingRequests,
    pendingApprovals,
    issueReports,
    xpTotal: (userRow.xp_total as number | undefined) ?? 0,
    role,
    userName: userRow.name,
  })
}
