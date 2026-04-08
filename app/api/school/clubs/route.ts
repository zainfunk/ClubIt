import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Club, Role } from '@/types'

export const dynamic = 'force-dynamic'

type ClubOwnerRole = Extract<Role, 'admin' | 'advisor' | 'superadmin'>

interface RequesterContext {
  userId: string
  role: Role
  schoolId: string | null
  name: string
  email: string
}

function mapClubRowToClub(row: {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  capacity: number | null
  advisor_id: string | null
  auto_accept: boolean | null
  tags: string[] | null
  event_creator_ids: string[] | null
  created_at: string
}): Club {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    iconUrl: row.icon_url ?? undefined,
    capacity: row.capacity,
    advisorId: row.advisor_id ?? '',
    memberIds: [],
    leadershipPositions: [],
    socialLinks: [],
    meetingTimes: [],
    tags: row.tags ?? [],
    eventCreatorIds: row.event_creator_ids ?? [],
    createdAt: row.created_at,
    autoAccept: row.auto_accept ?? false,
  }
}

async function getRequesterContext(): Promise<RequesterContext | null> {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role, name, email')
    .eq('id', userId)
    .maybeSingle()

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)

  return {
    userId,
    role: (userRow?.role as Role | undefined) ?? (clerkUser.publicMetadata?.role as Role | undefined) ?? 'student',
    schoolId: userRow?.school_id ?? null,
    name: clerkUser.fullName ?? clerkUser.username ?? userRow?.name ?? 'New User',
    email: clerkUser.primaryEmailAddress?.emailAddress ?? userRow?.email ?? '',
  }
}

function parseCapacity(value: unknown) {
  if (value === null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.round(parsed)
}

export async function GET() {
  const requester = await getRequesterContext()
  if (!requester) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!requester.schoolId) {
    return NextResponse.json({
      clubs: [],
      advisorNames: {},
      myMembershipClubIds: [],
    })
  }

  const db = createServiceClient()
  const { data: clubRows, error: clubsError } = await db
    .from('clubs')
    .select('id, name, description, icon_url, capacity, advisor_id, auto_accept, tags, event_creator_ids, created_at')
    .eq('school_id', requester.schoolId)
    .order('created_at', { ascending: false })

  if (clubsError) {
    console.error('clubs load error', clubsError)
    return NextResponse.json({ error: 'Failed to load clubs' }, { status: 500 })
  }

  const clubIds = (clubRows ?? []).map((club) => club.id)
  const advisorIds = [...new Set((clubRows ?? []).map((club) => club.advisor_id).filter(Boolean))]

  const [{ data: memberships, error: membershipsError }, { data: advisorRows, error: advisorsError }] = await Promise.all([
    clubIds.length > 0
      ? db.from('memberships').select('club_id, user_id').in('club_id', clubIds)
      : Promise.resolve({ data: [], error: null }),
    advisorIds.length > 0
      ? db.from('users').select('id, name').in('id', advisorIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (membershipsError) {
    console.error('club memberships load error', membershipsError)
    return NextResponse.json({ error: 'Failed to load club memberships' }, { status: 500 })
  }

  if (advisorsError) {
    console.error('club advisors load error', advisorsError)
    return NextResponse.json({ error: 'Failed to load club advisors' }, { status: 500 })
  }

  const memberIdsByClub: Record<string, string[]> = {}
  for (const membership of memberships ?? []) {
    if (!memberIdsByClub[membership.club_id]) {
      memberIdsByClub[membership.club_id] = []
    }
    memberIdsByClub[membership.club_id].push(membership.user_id)
  }

  const advisorNames: Record<string, string> = {}
  for (const advisor of advisorRows ?? []) {
    advisorNames[advisor.id] = advisor.name
  }

  const clubs = (clubRows ?? []).map((clubRow) => ({
    ...mapClubRowToClub(clubRow),
    memberIds: memberIdsByClub[clubRow.id] ?? [],
  }))

  return NextResponse.json({
    clubs,
    advisorNames,
    myMembershipClubIds: (memberships ?? [])
      .filter((membership) => membership.user_id === requester.userId)
      .map((membership) => membership.club_id),
  })
}

export async function POST(request: NextRequest) {
  const requester = await getRequesterContext()
  if (!requester) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (requester.role !== 'admin' && requester.role !== 'advisor' && requester.role !== 'superadmin') {
    return NextResponse.json(
      {
        error: `Only saved school admins or advisors can create clubs. Your current saved role is "${requester.role}". Re-enter your school's admin invite code on /join if this account should be admin.`,
      },
      { status: 403 }
    )
  }

  if (!requester.schoolId) {
    return NextResponse.json({ error: 'You must belong to a school before creating clubs' }, { status: 400 })
  }

  const body = await request.json() as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const iconUrl = typeof body.iconUrl === 'string' ? body.iconUrl.trim() : ''
  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter((tag: unknown): tag is string => typeof tag === 'string')
        .map((tag: string) => tag.trim())
        .filter(Boolean)
    : []
  const ownerId = typeof body.advisorId === 'string' && body.advisorId.trim()
    ? body.advisorId.trim()
    : requester.userId
  const capacity = parseCapacity(body.capacity)
  const db = createServiceClient()

  if (!name) {
    return NextResponse.json({ error: 'Club name is required' }, { status: 400 })
  }

  if (!description) {
    return NextResponse.json({ error: 'Club description is required' }, { status: 400 })
  }

  if (body.capacity !== null && capacity === null) {
    return NextResponse.json({ error: 'Member limit must be a whole number greater than 0' }, { status: 400 })
  }

  await db
    .from('users')
    .upsert(
      {
        id: requester.userId,
        name: requester.name,
        email: requester.email,
        role: requester.role,
        school_id: requester.schoolId,
      },
      { onConflict: 'id' }
    )

  let ownerRole: ClubOwnerRole = requester.role as ClubOwnerRole

  if (ownerId !== requester.userId) {
    if (requester.role !== 'admin' && requester.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only saved school admins can assign clubs to another advisor or admin' },
        { status: 403 }
      )
    }

    const { data: owner, error: ownerError } = await db
      .from('users')
      .select('id, school_id, role')
      .eq('id', ownerId)
      .maybeSingle()

    if (ownerError) {
      console.error('club owner lookup error', ownerError)
      return NextResponse.json({ error: 'Failed to validate the selected owner' }, { status: 500 })
    }

    if (!owner) {
      return NextResponse.json({ error: 'Selected owner was not found in this school' }, { status: 404 })
    }

    if (owner.school_id !== requester.schoolId) {
      return NextResponse.json({ error: 'Selected owner must belong to your school' }, { status: 409 })
    }

    if (owner.role !== 'advisor' && owner.role !== 'admin' && owner.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Selected owner must be an advisor or admin' },
        { status: 409 }
      )
    }

    ownerRole = owner.role as ClubOwnerRole
  }

  if (requester.role === 'advisor' && ownerRole !== 'advisor') {
    return NextResponse.json(
      { error: 'Saved advisor accounts can only create clubs owned by their own advisor account' },
      { status: 403 }
    )
  }

  const createdAt = new Date().toISOString().split('T')[0]
  const clubId = `club-${crypto.randomUUID()}`

  const { data: clubRow, error: insertError } = await db
    .from('clubs')
    .insert({
      id: clubId,
      name,
      description,
      icon_url: iconUrl || null,
      capacity,
      advisor_id: ownerId,
      auto_accept: false,
      tags,
      event_creator_ids: [],
      created_at: createdAt,
      school_id: requester.schoolId,
    })
    .select('id, name, description, icon_url, capacity, advisor_id, auto_accept, tags, event_creator_ids, created_at')
    .single()

  if (insertError || !clubRow) {
    console.error('club create error', insertError)
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to create club' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, club: mapClubRowToClub(clubRow) })
}
