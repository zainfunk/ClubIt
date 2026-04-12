import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role !== 'superadmin') return null
  return userId
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  // Fetch school
  const { data: school, error: schoolErr } = await db
    .from('schools')
    .select('*')
    .eq('id', id)
    .single()

  if (schoolErr || !school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }

  // Fetch users belonging to this school
  const { data: users } = await db
    .from('users')
    .select('id, name, email, role, created_at')
    .eq('school_id', id)

  const safeUsers = users ?? []

  // Fetch clubs belonging to this school
  const { data: clubRows } = await db
    .from('clubs')
    .select('id, name, description, advisor_id, created_at, school_id')
    .eq('school_id', id)

  const safeClubs = clubRows ?? []
  const clubIds = safeClubs.map((c) => c.id)

  // Fetch membership counts per club
  let memberCountMap: Record<string, number> = {}
  if (clubIds.length > 0) {
    const { data: memberships } = await db
      .from('memberships')
      .select('club_id')
      .in('club_id', clubIds)

    if (memberships) {
      for (const m of memberships) {
        memberCountMap[m.club_id] = (memberCountMap[m.club_id] || 0) + 1
      }
    }
  }

  const clubs = safeClubs.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    advisor_id: c.advisor_id,
    memberCount: memberCountMap[c.id] || 0,
    created_at: c.created_at,
  }))

  // Stats: total memberships
  let totalMemberships = 0
  if (clubIds.length > 0) {
    const { count } = await db
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .in('club_id', clubIds)
    totalMemberships = count ?? 0
  }

  // Stats: total messages
  let totalMessages = 0
  if (clubIds.length > 0) {
    const { count } = await db
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .in('club_id', clubIds)
    totalMessages = count ?? 0
  }

  // Stats: total events
  let totalEvents = 0
  if (clubIds.length > 0) {
    const { count } = await db
      .from('events')
      .select('*', { count: 'exact', head: true })
      .in('club_id', clubIds)
    totalEvents = count ?? 0
  }

  // Stats: open issue reports
  const { count: openIssueReports } = await db
    .from('issue_reports')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', id)
    .eq('status', 'open')

  // Stats: active elections
  const { count: activeElections } = await db
    .from('school_elections')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', id)
    .eq('is_open', true)

  const studentCount = safeUsers.filter((u) => u.role === 'student').length
  const advisorCount = safeUsers.filter((u) => u.role === 'advisor').length
  const adminCount = safeUsers.filter((u) => u.role === 'admin').length

  const stats = {
    totalUsers: safeUsers.length,
    studentCount,
    advisorCount,
    adminCount,
    clubCount: safeClubs.length,
    totalMessages,
    totalEvents,
    totalMemberships,
    openIssueReports: openIssueReports ?? 0,
    activeElections: activeElections ?? 0,
  }

  // Recent activity: chat messages
  let recentMessages: Array<{ type: string; description: string; timestamp: string }> = []
  if (clubIds.length > 0) {
    const { data: msgs } = await db
      .from('chat_messages')
      .select('sent_at, club_id')
      .in('club_id', clubIds)
      .order('sent_at', { ascending: false })
      .limit(10)

    const clubNameMap: Record<string, string> = {}
    for (const c of safeClubs) clubNameMap[c.id] = c.name

    if (msgs) {
      recentMessages = msgs.map((m) => ({
        type: 'message',
        description: `Message in ${clubNameMap[m.club_id] || 'Unknown Club'}`,
        timestamp: m.sent_at,
      }))
    }
  }

  // Recent activity: events
  let recentEvents: Array<{ type: string; description: string; timestamp: string }> = []
  if (clubIds.length > 0) {
    const { data: evts } = await db
      .from('events')
      .select('title, date')
      .in('club_id', clubIds)
      .order('date', { ascending: false })
      .limit(10)

    if (evts) {
      recentEvents = evts.map((e) => ({
        type: 'event',
        description: `Event: ${e.title}`,
        timestamp: e.date,
      }))
    }
  }

  // Recent activity: join requests
  let recentJoinRequests: Array<{ type: string; description: string; timestamp: string }> = []
  if (clubIds.length > 0) {
    const { data: jrs } = await db
      .from('join_requests')
      .select('requested_at, user_id, club_id')
      .in('club_id', clubIds)
      .order('requested_at', { ascending: false })
      .limit(10)

    if (jrs) {
      const userNameMap: Record<string, string> = {}
      for (const u of safeUsers) userNameMap[u.id] = u.name
      const clubNameMap: Record<string, string> = {}
      for (const c of safeClubs) clubNameMap[c.id] = c.name

      recentJoinRequests = jrs.map((jr) => ({
        type: 'join_request',
        description: `${userNameMap[jr.user_id] || 'Unknown user'} requested to join ${clubNameMap[jr.club_id] || 'Unknown club'}`,
        timestamp: jr.requested_at,
      }))
    }
  }

  const recentActivity = [...recentMessages, ...recentEvents, ...recentJoinRequests]
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
    .slice(0, 20)

  // Issue reports
  const { data: issueRows } = await db
    .from('issue_reports')
    .select('id, reporter_name, message, status, created_at')
    .eq('school_id', id)
    .order('created_at', { ascending: false })

  const issueReports = issueRows ?? []

  // Settings: query admin_settings scoped to school
  let settings: {
    achievementsFeatureEnabled: boolean
    attendanceFeatureEnabled: boolean
    clubsFeatureEnabled: boolean
    studentSocialsEnabled: boolean
  } | null = null

  const { data: settingsRow } = await db
    .from('admin_settings')
    .select('achievements_enabled, attendance_enabled, clubs_enabled, student_socials_enabled')
    .eq('school_id', id)
    .maybeSingle()

  if (settingsRow) {
    settings = {
      achievementsFeatureEnabled: settingsRow.achievements_enabled ?? true,
      attendanceFeatureEnabled: settingsRow.attendance_enabled ?? true,
      clubsFeatureEnabled: settingsRow.clubs_enabled ?? true,
      studentSocialsEnabled: settingsRow.student_socials_enabled ?? true,
    }
  }

  return NextResponse.json({
    school,
    stats,
    users: safeUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      created_at: u.created_at ?? undefined,
    })),
    clubs,
    recentActivity,
    issueReports,
    settings,
  })
}
