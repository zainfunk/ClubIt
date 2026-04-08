import { getRecordsByClub, getSessionsByClub } from '@/lib/attendance-store'
import { supabase } from '@/lib/supabase'
import {
  Club,
  ClubEvent,
  ClubForm,
  ClubNews,
  JoinRequest,
  LeadershipPosition,
  MeetingTime,
  Membership,
  Poll,
  Role,
  SchoolElection,
  SocialLink,
  User,
} from '@/types'

type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  school_id?: string | null
  avatar_url?: string | null
}

type UserOverrideRow = {
  user_id: string
  name?: string | null
  email?: string | null
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
  created_at?: string | null
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function mapUser(row: UserRow, override?: UserOverrideRow): User {
  return {
    id: row.id,
    name: override?.name?.trim() || row.name,
    email: override?.email?.trim() || row.email,
    role: row.role,
    avatarUrl: row.avatar_url ?? undefined,
    schoolId: row.school_id ?? undefined,
  }
}

function mapClub(row: ClubRow): Club {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    iconUrl: row.icon_url ?? undefined,
    capacity: row.capacity ?? null,
    advisorId: row.advisor_id ?? '',
    memberIds: [],
    eventCreatorIds: row.event_creator_ids ?? [],
    leadershipPositions: [],
    socialLinks: [],
    meetingTimes: [],
    tags: row.tags ?? [],
    createdAt: row.created_at ?? '',
    autoAccept: row.auto_accept ?? false,
  }
}

async function fetchUserOverrides(userIds: string[]) {
  if (userIds.length === 0) return {}

  const { data } = await supabase
    .from('user_overrides')
    .select('user_id, name, email')
    .in('user_id', userIds)

  const byUserId: Record<string, UserOverrideRow> = {}
  for (const row of data ?? []) {
    byUserId[row.user_id] = row as UserOverrideRow
  }
  return byUserId
}

async function enrichClubs(rows: ClubRow[]): Promise<Club[]> {
  if (rows.length === 0) return []

  const clubIds = rows.map((row) => row.id)
  const [membershipRes, leadershipRes] = await Promise.all([
    supabase
      .from('memberships')
      .select('club_id, user_id')
      .in('club_id', clubIds),
    supabase
      .from('leadership_positions')
      .select('id, club_id, title, user_id')
      .in('club_id', clubIds),
  ])

  const memberIdsByClub: Record<string, string[]> = {}
  for (const row of membershipRes.data ?? []) {
    if (!memberIdsByClub[row.club_id]) memberIdsByClub[row.club_id] = []
    memberIdsByClub[row.club_id].push(row.user_id)
  }

  const leadershipByClub: Record<string, LeadershipPosition[]> = {}
  for (const row of leadershipRes.data ?? []) {
    if (!leadershipByClub[row.club_id]) leadershipByClub[row.club_id] = []
    leadershipByClub[row.club_id].push({
      id: row.id,
      title: row.title,
      userId: row.user_id ?? undefined,
    })
  }

  return rows.map((row) => ({
    ...mapClub(row),
    memberIds: memberIdsByClub[row.id] ?? [],
    leadershipPositions: leadershipByClub[row.id] ?? [],
  }))
}

export async function fetchUsersByIds(userIds: string[]): Promise<Record<string, User>> {
  const ids = unique(userIds.filter(Boolean))
  if (ids.length === 0) return {}

  const [{ data: users }, overrides] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, school_id, avatar_url')
      .in('id', ids),
    fetchUserOverrides(ids),
  ])

  const byId: Record<string, User> = {}
  for (const row of users ?? []) {
    byId[row.id] = mapUser(row as UserRow, overrides[row.id])
  }
  return byId
}

export async function fetchSchoolUsers(schoolId: string): Promise<User[]> {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, role, school_id, avatar_url')
    .eq('school_id', schoolId)
    .order('name')

  const userRows = (data ?? []) as UserRow[]
  const overrides = await fetchUserOverrides(userRows.map((row) => row.id))

  return userRows.map((row) => mapUser(row, overrides[row.id]))
}

export async function fetchClubsByIds(clubIds: string[]): Promise<Club[]> {
  const ids = unique(clubIds.filter(Boolean))
  if (ids.length === 0) return []

  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, icon_url, capacity, advisor_id, tags, event_creator_ids, auto_accept, created_at')
    .in('id', ids)

  return enrichClubs((data ?? []) as ClubRow[])
}

export async function fetchSchoolClubs(schoolId: string): Promise<Club[]> {
  const { data } = await supabase
    .from('clubs')
    .select('id, name, description, icon_url, capacity, advisor_id, tags, event_creator_ids, auto_accept, created_at')
    .eq('school_id', schoolId)
    .order('name')

  return enrichClubs((data ?? []) as ClubRow[])
}

export async function fetchClubDetail(clubId: string, schoolId: string) {
  const { data: clubRow } = await supabase
    .from('clubs')
    .select('id, name, description, icon_url, capacity, advisor_id, tags, event_creator_ids, auto_accept, created_at')
    .eq('id', clubId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!clubRow) return null

  const [
    clubs,
    membershipRes,
    requestRes,
    socialRes,
    meetingRes,
    eventRes,
    newsRes,
    pollRes,
    attendanceRecords,
    attendanceSessions,
  ] = await Promise.all([
    enrichClubs([clubRow as ClubRow]),
    supabase.from('memberships').select('id, club_id, user_id, joined_at').eq('club_id', clubId),
    supabase.from('join_requests').select('id, club_id, user_id, requested_at, status').eq('club_id', clubId),
    supabase.from('club_social_links').select('club_id, platform, url').eq('club_id', clubId),
    supabase.from('meeting_times').select('id, club_id, day_of_week, start_time, end_time, location').eq('club_id', clubId),
    supabase.from('events').select('id, club_id, title, description, date, location, is_public, created_by').eq('club_id', clubId),
    supabase.from('club_news').select('id, club_id, title, content, author_id, created_at, is_pinned').eq('club_id', clubId),
    supabase.from('polls').select('id, club_id, position_title, created_at, is_open, poll_candidates(user_id), poll_votes(candidate_user_id, voter_user_id)').eq('club_id', clubId),
    getRecordsByClub(clubId),
    getSessionsByClub(clubId),
  ])

  const club = clubs[0]
  const memberships: Membership[] = (membershipRes.data ?? []).map((row) => ({
    id: row.id,
    clubId: row.club_id,
    userId: row.user_id,
    joinedAt: row.joined_at,
  }))

  const requests: JoinRequest[] = (requestRes.data ?? []).map((row) => ({
    id: row.id,
    clubId: row.club_id,
    userId: row.user_id,
    requestedAt: row.requested_at,
    status: row.status,
  }))

  const socialLinks: SocialLink[] = (socialRes.data ?? []).map((row) => ({
    platform: row.platform,
    url: row.url,
  }))

  const meetingTimes: MeetingTime[] = (meetingRes.data ?? []).map((row) => ({
    id: row.id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location ?? undefined,
  }))

  const events: ClubEvent[] = (eventRes.data ?? []).map((row) => ({
    id: row.id,
    clubId: row.club_id,
    title: row.title,
    description: row.description ?? '',
    date: row.date,
    location: row.location ?? undefined,
    isPublic: row.is_public,
    createdBy: row.created_by,
  })).sort((a, b) => a.date.localeCompare(b.date))

  const news: ClubNews[] = (newsRes.data ?? []).map((row) => ({
    id: row.id,
    clubId: row.club_id,
    title: row.title,
    content: row.content,
    authorId: row.author_id,
    createdAt: row.created_at,
    isPinned: row.is_pinned,
  })).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const polls: Poll[] = (pollRes.data ?? []).map((row) => ({
    id: row.id,
    clubId: row.club_id,
    positionTitle: row.position_title,
    createdAt: row.created_at,
    isOpen: row.is_open,
    candidates: ((row.poll_candidates ?? []) as { user_id: string }[]).map((candidate) => ({
      userId: candidate.user_id,
      votes: ((row.poll_votes ?? []) as { candidate_user_id: string; voter_user_id: string }[])
        .filter((vote) => vote.candidate_user_id === candidate.user_id)
        .map((vote) => vote.voter_user_id),
    })),
  }))

  club.socialLinks = socialLinks
  club.meetingTimes = meetingTimes

  const relatedUserIds = unique([
    club.advisorId,
    ...club.memberIds,
    ...club.eventCreatorIds,
    ...club.leadershipPositions.map((position) => position.userId ?? ''),
    ...requests.map((request) => request.userId),
    ...events.map((event) => event.createdBy),
    ...news.map((item) => item.authorId),
    ...polls.flatMap((poll) => poll.candidates.map((candidate) => candidate.userId)),
  ].filter(Boolean))

  const usersById = await fetchUsersByIds(relatedUserIds)

  return {
    club,
    memberships,
    requests,
    events,
    news,
    polls,
    attendanceRecords,
    attendanceSessions,
    usersById,
  }
}

export async function fetchSchoolElectionById(id: string, schoolId: string): Promise<SchoolElection | null> {
  const { data } = await supabase
    .from('school_elections')
    .select('id, position_title, description, created_at, is_open, election_candidates(user_id), election_votes(candidate_user_id, voter_user_id)')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    positionTitle: data.position_title,
    description: data.description ?? '',
    createdAt: data.created_at,
    isOpen: data.is_open,
    candidates: ((data.election_candidates ?? []) as { user_id: string }[]).map((candidate) => ({
      userId: candidate.user_id,
      votes: ((data.election_votes ?? []) as { candidate_user_id: string; voter_user_id: string }[])
        .filter((vote) => vote.candidate_user_id === candidate.user_id)
        .map((vote) => vote.voter_user_id),
    })),
  }
}

export async function fetchPollById(id: string, schoolId: string): Promise<Poll | null> {
  const { data: pollRow } = await supabase
    .from('polls')
    .select('id, club_id, position_title, created_at, is_open, poll_candidates(user_id), poll_votes(candidate_user_id, voter_user_id)')
    .eq('id', id)
    .maybeSingle()

  if (!pollRow) return null

  const { data: clubRow } = await supabase
    .from('clubs')
    .select('school_id')
    .eq('id', pollRow.club_id)
    .maybeSingle()

  if (!clubRow || clubRow.school_id !== schoolId) return null

  return {
    id: pollRow.id,
    clubId: pollRow.club_id,
    positionTitle: pollRow.position_title,
    createdAt: pollRow.created_at,
    isOpen: pollRow.is_open,
    candidates: ((pollRow.poll_candidates ?? []) as { user_id: string }[]).map((candidate) => ({
      userId: candidate.user_id,
      votes: ((pollRow.poll_votes ?? []) as { candidate_user_id: string; voter_user_id: string }[])
        .filter((vote) => vote.candidate_user_id === candidate.user_id)
        .map((vote) => vote.voter_user_id),
    })),
  }
}

export async function fetchClubFormById(id: string, schoolId: string): Promise<ClubForm | null> {
  const { data: formRow } = await supabase
    .from('club_forms')
    .select('id, club_id, title, description, form_type, is_open, closes_at, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!formRow) return null

  const { data: clubRow } = await supabase
    .from('clubs')
    .select('school_id')
    .eq('id', formRow.club_id)
    .maybeSingle()

  if (!clubRow || clubRow.school_id !== schoolId) return null

  return {
    id: formRow.id,
    clubId: formRow.club_id,
    title: formRow.title,
    description: formRow.description ?? '',
    formType: formRow.form_type,
    isOpen: formRow.is_open,
    closesAt: formRow.closes_at ?? null,
    createdAt: formRow.created_at,
  }
}
