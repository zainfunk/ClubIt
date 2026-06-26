'use client'

// Client-side fetch wrappers around the school server API routes.
//
// These routes run with the service-role key and resolve school context
// server-side from the Clerk session, so they are NOT subject to the
// client-side RLS / Clerk-JWT-bridge fragility that makes the direct
// `supabase` (anon-key) reads in `lib/school-data.ts` return empty on the
// phone shell. Mobile screens (and the web profile page) should read through
// here and guard on `actualUser.id`, mirroring the desktop pages that already
// hit `/api/school/*`.

import type {
  AttendanceRecord,
  AttendanceSession,
  Club,
  ClubDuesPayment,
  ClubEvent,
  ClubNews,
  JoinRequest,
  Membership,
  Poll,
  User,
} from '@/types'

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return (await res.json()) as T
}

export interface SchoolClubsPayload {
  clubs: Club[]
  advisorNames: Record<string, string>
  myMembershipClubIds: string[]
}

/** All clubs in the caller's school (newest first), with advisor names. */
export function apiSchoolClubs(): Promise<SchoolClubsPayload> {
  return getJSON<SchoolClubsPayload>('/api/school/clubs')
}

/** All users in the caller's school (overrides applied). */
export function apiSchoolUsers(): Promise<User[]> {
  return getJSON<{ users: User[] }>('/api/school/users').then((d) => d.users ?? [])
}

export interface SchoolUserPayload {
  user: User | null
  memberClubs: Club[]
  advisingClubs: Club[]
  usersById: Record<string, User>
}

/** A single user in the caller's school, with their member + advised clubs. */
export function apiSchoolUser(id: string): Promise<SchoolUserPayload> {
  return getJSON<SchoolUserPayload>(`/api/school/users/${id}`)
}

export interface SchoolEvent {
  id: string
  clubId: string
  clubName: string
  clubIconUrl: string | null
  title: string
  description: string
  date: string
  location: string | null
  isPublic: boolean
  createdBy: string
}

/** All events across the caller's school clubs (soonest first). */
export function apiSchoolEvents(): Promise<SchoolEvent[]> {
  return getJSON<{ events: SchoolEvent[] }>('/api/school/events').then((d) => d.events ?? [])
}

export interface SchoolIssue {
  id: string
  message: string
  reporter_name: string
  reporter_email: string
  status: string
  created_at: string
}

/** Open issue reports for the caller's school (admins/advisors only). */
export function apiSchoolIssues(): Promise<SchoolIssue[]> {
  return getJSON<{ issues: SchoolIssue[] }>('/api/school/issues').then((d) => d.issues ?? [])
}

/** Resolve an issue report. */
export async function apiResolveIssue(id: string): Promise<void> {
  const res = await fetch('/api/school/issues', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(`resolve issue → ${res.status}`)
}

/** Submit an issue report (routed to the school's admins/advisors). */
export async function apiSubmitIssue(message: string): Promise<void> {
  const res = await fetch('/api/school/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `submit issue → ${res.status}`)
  }
}

/** Cast a vote in a club poll (service-role; persists on the iOS shell). */
export async function apiCastPollVote(pollId: string, candidateUserId: string): Promise<void> {
  const res = await fetch(`/api/school/polls/${pollId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateUserId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Vote failed (${res.status})`)
  }
}

/** Attendance records for one club, plus per-member hour adjustments (manager view). */
export function apiClubAttendance(
  clubId: string,
): Promise<{ records: AttendanceRecord[]; adjustments: Record<string, number> }> {
  return getJSON(`/api/school/attendance?clubId=${encodeURIComponent(clubId)}`)
}

/** Attendance records for one user across the caller's school (privacy-gated server-side). */
export function apiUserAttendance(userId: string): Promise<AttendanceRecord[]> {
  return getJSON<{ records: AttendanceRecord[] }>(
    `/api/school/attendance?userId=${encodeURIComponent(userId)}`,
  ).then((d) => d.records ?? [])
}

export interface ClubDetailPayload {
  club: Club
  memberships: Membership[]
  requests: JoinRequest[]
  events: ClubEvent[]
  news: ClubNews[]
  polls: Poll[]
  attendanceRecords: AttendanceRecord[]
  attendanceSessions: AttendanceSession[]
  duesPayments: ClubDuesPayment[]
  usersById: Record<string, User>
}

/** Full detail for one club (members, requests, events, news, polls…). */
export async function apiClubDetail(id: string): Promise<ClubDetailPayload | null> {
  const res = await fetch(`/api/school/clubs/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as ClubDetailPayload
}

/**
 * Run a management action on a club (PATCH /api/school/clubs/[id]). The action
 * discriminator + payload mirror the desktop club page: save_edit, save_capacity,
 * toggle_auto_accept, add/remove_leadership_position, appoint_leader, vacate_leader,
 * add/remove_meeting_time, create_event, delete_event, post_news, delete_news,
 * create_poll, cast_poll_vote, close_poll, appoint_poll_winner, set_event_creators,
 * set_dues_amount, mark_dues_paid, mark_dues_unpaid, approve, reject.
 * Throws on a non-OK response with the server error message.
 */
export async function clubAction(clubId: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/school/clubs/${clubId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Action failed (${res.status})`)
  }
}

/** Permanently delete a club (advisor owner / admin / superadmin only). */
export async function deleteClub(clubId: string): Promise<void> {
  const res = await fetch(`/api/school/clubs/${clubId}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Delete failed (${res.status})`)
  }
}

export interface DashboardPayload {
  clubs: Club[]
  advisorNames: Record<string, string>
  myMembershipClubIds: string[]
  pinnedNews: Record<string, ClubNews>
  nextEvents: Record<string, ClubEvent>
  pendingRequests: (JoinRequest & { clubName: string; clubIcon?: string })[]
  pendingApprovals: { id: string; clubId: string; clubName: string; userId: string; userName: string }[]
  issueReports: SchoolIssue[]
  role: string
  userName: string
}

/** Role-aware home dashboard payload for the caller. */
export function apiDashboard(): Promise<Partial<DashboardPayload>> {
  return getJSON<Partial<DashboardPayload>>('/api/school/dashboard')
}
