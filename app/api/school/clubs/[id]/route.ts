import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import {
  Club,
  ClubEvent,
  ClubNews,
  JoinRequest,
  LeadershipPosition,
  MeetingTime,
  Membership,
  Poll,
  Role,
  SocialLink,
  User,
  AttendanceRecord,
  AttendanceSession,
} from '@/types'

export const dynamic = 'force-dynamic'

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: PageProps) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: userRow } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()

  const schoolId = userRow?.school_id as string | null
  if (!schoolId) {
    return NextResponse.json({ error: 'No school context' }, { status: 400 })
  }

  const { id: clubId } = await params

  const { data: clubRow } = await db
    .from('clubs')
    .select('id, name, description, icon_url, capacity, advisor_id, tags, event_creator_ids, auto_accept, created_at')
    .eq('id', clubId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!clubRow) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  // Enrich club with memberships and leadership
  const [membershipRes, leadershipRes, requestRes, socialRes, meetingRes, eventRes, newsRes, pollRes, attendanceRecordsRes, attendanceSessionsRes] = await Promise.all([
    db.from('memberships').select('id, club_id, user_id, joined_at').eq('club_id', clubId),
    db.from('leadership_positions').select('id, club_id, title, user_id').eq('club_id', clubId),
    db.from('join_requests').select('id, club_id, user_id, requested_at, status').eq('club_id', clubId),
    db.from('club_social_links').select('club_id, platform, url').eq('club_id', clubId),
    db.from('meeting_times').select('id, club_id, day_of_week, start_time, end_time, location').eq('club_id', clubId),
    db.from('events').select('id, club_id, title, description, date, location, is_public, created_by').eq('club_id', clubId),
    db.from('club_news').select('id, club_id, title, content, author_id, created_at, is_pinned').eq('club_id', clubId),
    db.from('polls').select('id, club_id, position_title, created_at, is_open, poll_candidates(user_id), poll_votes(candidate_user_id, voter_user_id)').eq('club_id', clubId),
    db.from('attendance_records').select('*').eq('club_id', clubId),
    db.from('attendance_sessions').select('*').eq('club_id', clubId),
  ])

  const memberIds = (membershipRes.data ?? []).map((r) => r.user_id)
  const leadershipPositions: LeadershipPosition[] = (leadershipRes.data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    userId: r.user_id ?? undefined,
  }))

  const club: Club = {
    id: clubRow.id,
    name: clubRow.name,
    description: clubRow.description ?? '',
    iconUrl: clubRow.icon_url ?? undefined,
    capacity: clubRow.capacity ?? null,
    advisorId: clubRow.advisor_id ?? '',
    memberIds,
    eventCreatorIds: clubRow.event_creator_ids ?? [],
    leadershipPositions,
    socialLinks: (socialRes.data ?? []).map((r) => ({ platform: r.platform, url: r.url })) as SocialLink[],
    meetingTimes: (meetingRes.data ?? []).map((r) => ({
      id: r.id,
      dayOfWeek: r.day_of_week,
      startTime: r.start_time,
      endTime: r.end_time,
      location: r.location ?? undefined,
    })) as MeetingTime[],
    tags: clubRow.tags ?? [],
    createdAt: clubRow.created_at,
    autoAccept: clubRow.auto_accept ?? false,
  }

  const memberships: Membership[] = (membershipRes.data ?? []).map((r) => ({
    id: r.id,
    clubId: r.club_id,
    userId: r.user_id,
    joinedAt: r.joined_at,
  }))

  const requests: JoinRequest[] = (requestRes.data ?? []).map((r) => ({
    id: r.id,
    clubId: r.club_id,
    userId: r.user_id,
    requestedAt: r.requested_at,
    status: r.status,
  }))

  const events: ClubEvent[] = (eventRes.data ?? []).map((r) => ({
    id: r.id,
    clubId: r.club_id,
    title: r.title,
    description: r.description ?? '',
    date: r.date,
    location: r.location ?? undefined,
    isPublic: r.is_public,
    createdBy: r.created_by,
  })).sort((a, b) => a.date.localeCompare(b.date))

  const news: ClubNews[] = (newsRes.data ?? []).map((r) => ({
    id: r.id,
    clubId: r.club_id,
    title: r.title,
    content: r.content,
    authorId: r.author_id,
    createdAt: r.created_at,
    isPinned: r.is_pinned,
  })).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const polls: Poll[] = (pollRes.data ?? []).map((r) => ({
    id: r.id,
    clubId: r.club_id,
    positionTitle: r.position_title,
    createdAt: r.created_at,
    isOpen: r.is_open,
    candidates: ((r.poll_candidates ?? []) as { user_id: string }[]).map((c) => ({
      userId: c.user_id,
      votes: ((r.poll_votes ?? []) as { candidate_user_id: string; voter_user_id: string }[])
        .filter((v) => v.candidate_user_id === c.user_id)
        .map((v) => v.voter_user_id),
    })),
  }))

  const attendanceRecords: AttendanceRecord[] = (attendanceRecordsRes.data ?? []).map((r) => ({
    id: r.id as string,
    clubId: r.club_id as string,
    userId: r.user_id as string,
    meetingDate: r.meeting_date as string,
    present: r.present as boolean,
  }))

  const attendanceSessions: AttendanceSession[] = (attendanceSessionsRes.data ?? []).map((r) => ({
    id: r.id as string,
    clubId: r.club_id as string,
    meetingDate: r.meeting_date as string,
    createdBy: r.created_by as string,
    expiresAt: r.expires_at as string,
    maxDistanceMeters: r.max_distance_meters as number,
    advisorLat: r.advisor_lat as number | undefined,
    advisorLng: r.advisor_lng as number | undefined,
    recordedUserIds: r.recorded_user_ids as string[],
  }))

  // Resolve related users
  const relatedUserIds = unique([
    club.advisorId,
    ...club.memberIds,
    ...club.eventCreatorIds,
    ...club.leadershipPositions.map((p) => p.userId ?? ''),
    ...requests.map((r) => r.userId),
    ...events.map((e) => e.createdBy),
    ...news.map((n) => n.authorId),
    ...polls.flatMap((p) => p.candidates.map((c) => c.userId)),
  ].filter(Boolean))

  const usersById: Record<string, User> = {}
  if (relatedUserIds.length > 0) {
    const [{ data: userRows }, { data: overrideRows }] = await Promise.all([
      db.from('users').select('id, name, email, role, school_id, avatar_url').in('id', relatedUserIds),
      db.from('user_overrides').select('user_id, name, email').in('user_id', relatedUserIds),
    ])

    const overrides: Record<string, { name?: string | null; email?: string | null }> = {}
    for (const row of overrideRows ?? []) {
      overrides[row.user_id] = row
    }

    for (const row of userRows ?? []) {
      const o = overrides[row.id]
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

  return NextResponse.json({
    club,
    memberships,
    requests,
    events,
    news,
    polls,
    attendanceRecords,
    attendanceSessions,
    usersById,
  })
}

export async function PATCH(request: NextRequest, { params }: PageProps) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { id: clubId } = await params

  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  const schoolId = userRow?.school_id as string | null
  if (!schoolId) return NextResponse.json({ error: 'No school context' }, { status: 400 })

  const { data: clubRow } = await db
    .from('clubs')
    .select('id, advisor_id, capacity, auto_accept')
    .eq('id', clubId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!clubRow) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const isManager =
    clubRow.advisor_id === userId ||
    userRow?.role === 'admin' ||
    userRow?.role === 'superadmin'

  const body = await request.json() as { action: string; requestId?: string }
  const { action, requestId } = body

  if (action === 'approve') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

    const { data: req } = await db
      .from('join_requests')
      .select('user_id, status')
      .eq('id', requestId)
      .maybeSingle()

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    // Check capacity
    if (clubRow.capacity !== null) {
      const { count } = await db
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
      if ((count ?? 0) >= clubRow.capacity) {
        return NextResponse.json({ error: 'Club is full' }, { status: 409 })
      }
    }

    const joinedAt = new Date().toISOString().split('T')[0]
    await db.from('join_requests').update({ status: 'approved' }).eq('id', requestId)
    await db
      .from('memberships')
      .upsert(
        { id: `m-${requestId}`, club_id: clubId, user_id: req.user_id, joined_at: joinedAt },
        { onConflict: 'club_id,user_id' }
      )

    return NextResponse.json({ ok: true })
  }

  if (action === 'reject') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

    await db.from('join_requests').update({ status: 'rejected' }).eq('id', requestId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
