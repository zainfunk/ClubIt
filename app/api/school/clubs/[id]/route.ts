import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import {
  Club,
  ClubDuesPayment,
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
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize'

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
    .select('id, name, description, icon_url, capacity, advisor_id, tags, event_creator_ids, auto_accept, dues_amount_cents, created_at')
    .eq('id', clubId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!clubRow) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  // Enrich club with memberships and leadership
  const [membershipRes, leadershipRes, requestRes, socialRes, meetingRes, eventRes, newsRes, pollRes, attendanceRecordsRes, attendanceSessionsRes, duesRes] = await Promise.all([
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
    db.from('club_dues_payments').select('id, club_id, user_id, paid, paid_at, amount_cents, marked_by, updated_at').eq('club_id', clubId),
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
    duesAmountCents: clubRow.dues_amount_cents ?? 0,
  }

  const isClubManager =
    clubRow.advisor_id === userId

  // Members see only their own dues row; advisors/admins see all.
  const { data: callerRoleRow } = await db
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  const callerRole = (callerRoleRow?.role ?? 'student') as Role
  const canSeeAllDues = isClubManager || callerRole === 'admin' || callerRole === 'superadmin'

  const duesPayments: ClubDuesPayment[] = (duesRes.data ?? [])
    .filter((r) => canSeeAllDues || r.user_id === userId)
    .map((r) => ({
      id: r.id,
      clubId: r.club_id,
      userId: r.user_id,
      paid: r.paid,
      paidAt: r.paid_at ?? undefined,
      amountCents: r.amount_cents ?? 0,
      markedBy: r.marked_by ?? undefined,
      updatedAt: r.updated_at,
    }))

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

  // W2.2 secret ballot: aggregate counts server-side and only return the
  // caller's own vote pointer. voter_user_id never leaves this function.
  const polls: Poll[] = (pollRes.data ?? []).map((r) => {
    const allVotes = (r.poll_votes ?? []) as { candidate_user_id: string; voter_user_id: string }[]
    const counts = new Map<string, number>()
    for (const v of allVotes) {
      counts.set(v.candidate_user_id, (counts.get(v.candidate_user_id) ?? 0) + 1)
    }
    const myVote = allVotes.find((v) => v.voter_user_id === userId)
    return {
      id: r.id,
      clubId: r.club_id,
      positionTitle: r.position_title,
      createdAt: r.created_at,
      isOpen: r.is_open,
      candidates: ((r.poll_candidates ?? []) as { user_id: string }[]).map((c) => ({
        userId: c.user_id,
        voteCount: counts.get(c.user_id) ?? 0,
      })),
      myVoteCandidateId: myVote?.candidate_user_id ?? null,
    }
  })

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
    duesPayments,
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
    .select('id, advisor_id, capacity, auto_accept, event_creator_ids, dues_amount_cents')
    .eq('id', clubId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!clubRow) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const isManager =
    clubRow.advisor_id === userId ||
    userRow?.role === 'admin' ||
    userRow?.role === 'superadmin'

  const body = await request.json() as Record<string, unknown>
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

  if (action === 'join') {
    // Check already a member or already has a pending/approved request
    const { data: existing } = await db
      .from('join_requests')
      .select('id, status')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) return NextResponse.json({ ok: true, status: existing.status })

    const { data: existingMembership } = await db
      .from('memberships')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMembership) return NextResponse.json({ ok: true, status: 'approved' })

    const autoApprove = clubRow.auto_accept as boolean

    // Check capacity for auto-approve path
    if (autoApprove && clubRow.capacity !== null) {
      const { count } = await db
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
      if ((count ?? 0) >= clubRow.capacity) {
        // Club is full — fall through to pending request
      } else {
        const reqId = `req-${userId}-${Date.now()}`
        const now = new Date().toISOString()
        await db.from('join_requests').insert({ id: reqId, club_id: clubId, user_id: userId, requested_at: now, status: 'approved' })
        await db.from('memberships').upsert(
          { id: `m-${reqId}`, club_id: clubId, user_id: userId, joined_at: now.split('T')[0] },
          { onConflict: 'club_id,user_id' }
        )
        return NextResponse.json({ ok: true, status: 'approved' })
      }
    }

    const reqId = `req-${userId}-${Date.now()}`
    const now = new Date().toISOString()
    await db.from('join_requests').insert({ id: reqId, club_id: clubId, user_id: userId, requested_at: now, status: 'pending' })
    return NextResponse.json({ ok: true, status: 'pending' })
  }

  if (action === 'leave') {
    await db.from('memberships').delete().eq('club_id', clubId).eq('user_id', userId)
    await db.from('join_requests').delete().eq('club_id', clubId).eq('user_id', userId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'toggle_auto_accept') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { data: current } = await db.from('clubs').select('auto_accept').eq('id', clubId).maybeSingle()
    await db.from('clubs').update({ auto_accept: !current?.auto_accept }).eq('id', clubId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'save_edit') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { iconUrl, description, tags, socialLinks } = body as { iconUrl?: string; description?: string; tags?: string[]; socialLinks?: { platform: string; url: string }[] }
    const safeDesc = description ? sanitizeText(description) : ''
    const safeTags = (tags ?? []).map((t) => sanitizeText(t))
    await db.from('clubs').update({ icon_url: iconUrl ?? null, description: safeDesc, tags: safeTags }).eq('id', clubId)
    await db.from('club_social_links').delete().eq('club_id', clubId)
    if (socialLinks && socialLinks.length > 0) {
      await db.from('club_social_links').insert(socialLinks.map((sl) => ({ club_id: clubId, platform: sanitizeText(sl.platform), url: sanitizeUrl(sl.url) })))
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'save_capacity') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { capacity } = body as { capacity: number | null }
    await db.from('clubs').update({ capacity: capacity ?? null }).eq('id', clubId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_event_creators') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { eventCreatorIds } = body as { eventCreatorIds: string[] }
    await db.from('clubs').update({ event_creator_ids: eventCreatorIds }).eq('id', clubId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'add_leadership_position') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { title } = body as { title: string }
    const posId = `lp-${Date.now()}`
    await db.from('leadership_positions').insert({ id: posId, club_id: clubId, title: sanitizeText(title), user_id: null })
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove_leadership_position') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { positionId } = body as { positionId: string }
    await db.from('leadership_positions').delete().eq('id', positionId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'appoint_leader') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { positionId, appointUserId } = body as { positionId: string; appointUserId: string }
    await db.from('leadership_positions').update({ user_id: appointUserId }).eq('id', positionId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'vacate_leader') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { positionId } = body as { positionId: string }
    await db.from('leadership_positions').update({ user_id: null }).eq('id', positionId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'add_meeting_time') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { dayOfWeek, startTime, endTime, location } = body as { dayOfWeek: number; startTime: string; endTime: string; location?: string }
    const mtId = `mt-${Date.now()}`
    await db.from('meeting_times').insert({ id: mtId, club_id: clubId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, location: location ? sanitizeText(location) : null })
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove_meeting_time') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { meetingTimeId } = body as { meetingTimeId: string }
    await db.from('meeting_times').delete().eq('id', meetingTimeId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'create_event') {
    const isEventCreator = isManager || (clubRow.event_creator_ids as string[] ?? []).includes(userId)
    if (!isEventCreator) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { title, description, date, location, isPublic } = body as { title: string; description?: string; date: string; location?: string; isPublic?: boolean }
    const eventId = `event-${Date.now()}`
    await db.from('events').insert({ id: eventId, club_id: clubId, title: sanitizeText(title), description: sanitizeText(description ?? ''), date, location: location ? sanitizeText(location) : null, is_public: isPublic ?? true, created_by: userId })
    return NextResponse.json({ ok: true })
  }

  if (action === 'edit_event') {
    const { eventId, title, description, date, location, isPublic } = body as { eventId: string; title?: string; description?: string; date?: string; location?: string; isPublic?: boolean }
    const { data: ev } = await db.from('events').select('created_by, club_id').eq('id', eventId).maybeSingle()
    if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (ev.club_id !== clubId) return NextResponse.json({ error: 'Event does not belong to this club' }, { status: 400 })
    if (!isManager && ev.created_by !== userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    if (!title?.trim()) return NextResponse.json({ error: 'Event title is required' }, { status: 400 })
    if (!date) return NextResponse.json({ error: 'Event date is required' }, { status: 400 })
    await db.from('events').update({
      title: sanitizeText(title.trim()),
      description: sanitizeText(description ?? ''),
      date,
      location: location?.trim() ? sanitizeText(location.trim()) : null,
      is_public: isPublic ?? true,
    }).eq('id', eventId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_event') {
    const { eventId } = body as { eventId: string }
    const { data: ev } = await db.from('events').select('created_by').eq('id', eventId).maybeSingle()
    if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (!isManager && ev.created_by !== userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    await db.from('events').delete().eq('id', eventId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'post_news') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { title, content, isPinned } = body as { title: string; content: string; isPinned?: boolean }
    const newsId = `news-${Date.now()}`
    const createdAt = new Date().toISOString()
    await db.from('club_news').insert({ id: newsId, club_id: clubId, title: sanitizeText(title), content: sanitizeText(content), author_id: userId, created_at: createdAt, is_pinned: isPinned ?? false })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_news') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { newsId } = body as { newsId: string }
    await db.from('club_news').delete().eq('id', newsId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'create_poll') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { positionTitle, candidateIds } = body as { positionTitle: string; candidateIds: string[] }
    const pollId = `poll-${Date.now()}`
    const createdAt = new Date().toISOString()
    await db.from('polls').insert({ id: pollId, club_id: clubId, position_title: sanitizeText(positionTitle), created_at: createdAt, is_open: true })
    await db.from('poll_candidates').insert(candidateIds.map((uid) => ({ poll_id: pollId, user_id: uid })))
    return NextResponse.json({ ok: true })
  }

  if (action === 'cast_poll_vote') {
    const { pollId, candidateUserId } = body as { pollId: string; candidateUserId: string }
    // Idempotent — ignore if already voted
    const { count } = await db.from('poll_votes').select('*', { count: 'exact', head: true }).eq('poll_id', pollId).eq('voter_user_id', userId)
    if ((count ?? 0) === 0) {
      await db.from('poll_votes').insert({ poll_id: pollId, candidate_user_id: candidateUserId, voter_user_id: userId })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'close_poll') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { pollId } = body as { pollId: string }
    await db.from('polls').update({ is_open: false }).eq('id', pollId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'appoint_poll_winner') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { pollId } = body as { pollId: string }
    // Fetch poll + candidates + votes to determine winner server-side
    const { data: pollRow2 } = await db
      .from('polls')
      .select('position_title, poll_candidates(user_id), poll_votes(candidate_user_id, voter_user_id)')
      .eq('id', pollId)
      .maybeSingle()
    if (!pollRow2) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    const candidates = (pollRow2.poll_candidates as { user_id: string }[]) ?? []
    const votes = (pollRow2.poll_votes as { candidate_user_id: string }[]) ?? []
    const winner = candidates.reduce((best, c) => {
      const count2 = votes.filter((v) => v.candidate_user_id === c.user_id).length
      const bestCount = votes.filter((v) => v.candidate_user_id === best.user_id).length
      return count2 >= bestCount ? c : best
    }, candidates[0])
    if (!winner) return NextResponse.json({ error: 'No candidates' }, { status: 400 })

    const { data: existingPos } = await db
      .from('leadership_positions')
      .select('id')
      .eq('club_id', clubId)
      .ilike('title', pollRow2.position_title)
      .maybeSingle()

    if (existingPos) {
      await db.from('leadership_positions').update({ user_id: winner.user_id }).eq('id', existingPos.id)
    } else {
      await db.from('leadership_positions').insert({ id: `lp-${pollId}`, club_id: clubId, title: pollRow2.position_title, user_id: winner.user_id })
    }
    await db.from('polls').update({ is_open: false }).eq('id', pollId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_dues_amount') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { amountCents } = body as { amountCents: number }
    const safeAmount = Math.max(0, Math.min(1_000_000, Math.round(amountCents ?? 0)))
    await db.from('clubs').update({ dues_amount_cents: safeAmount }).eq('id', clubId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'mark_dues_paid' || action === 'mark_dues_unpaid') {
    if (!isManager) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { memberId } = body as { memberId: string }
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

    // Verify the target user is a member of this club
    const { data: membership } = await db
      .from('memberships')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', memberId)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'User is not a club member' }, { status: 400 })

    const paid = action === 'mark_dues_paid'
    const now = new Date().toISOString()
    const rowId = `dues-${clubId}-${memberId}`
    await db.from('club_dues_payments').upsert(
      {
        id: rowId,
        club_id: clubId,
        user_id: memberId,
        paid,
        paid_at: paid ? now : null,
        amount_cents: paid ? (clubRow as { dues_amount_cents?: number }).dues_amount_cents ?? 0 : 0,
        marked_by: userId,
        updated_at: now,
      },
      { onConflict: 'club_id,user_id' }
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE /api/school/clubs/[id] — permanently delete a club. Allowed for the
// club's advisor (owner), school admins, and superadmins. All club_id foreign
// keys are ON DELETE CASCADE (memberships, join_requests, leadership_positions,
// social links, meeting times, events, news, polls, dues, attendance, chat), so
// removing the club row removes everything tied to it.
export async function DELETE(_request: NextRequest, { params }: PageProps) {
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
    .select('id, advisor_id')
    .eq('id', clubId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!clubRow) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const canDelete =
    clubRow.advisor_id === userId ||
    userRow?.role === 'admin' ||
    userRow?.role === 'superadmin'

  if (!canDelete) {
    return NextResponse.json({ error: 'Only the club advisor or a school admin can delete this club' }, { status: 403 })
  }

  const { error } = await db.from('clubs').delete().eq('id', clubId).eq('school_id', schoolId)
  if (error) {
    console.error('club delete error', error)
    return NextResponse.json({ error: 'Failed to delete club' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
