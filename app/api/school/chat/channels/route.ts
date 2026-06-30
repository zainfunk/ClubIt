import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getRequester() {
  const { userId } = await auth()
  if (!userId) return null
  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()
  if (!userRow?.school_id) return null
  return { userId, schoolId: userRow.school_id as string, role: userRow.role as Role }
}

// GET /api/school/chat/channels?clubId=X — list channels for a club
export async function GET(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clubId = new URL(request.url).searchParams.get('clubId')
  if (!clubId) return NextResponse.json({ error: 'clubId is required' }, { status: 400 })

  const db = createServiceClient()

  const { data: club } = await db
    .from('clubs')
    .select('id, advisor_id')
    .eq('id', clubId)
    .eq('school_id', requester.schoolId)
    .maybeSingle()

  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const isAdmin = requester.role === 'admin' || requester.role === 'superadmin'
  const isAdvisor = club.advisor_id === requester.userId

  if (!isAdmin && !isAdvisor) {
    const { data: membership } = await db
      .from('memberships')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', requester.userId)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data: channels, error } = await db
    .from('chat_channels')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to load channels' }, { status: 500 })

  return NextResponse.json({
    channels: (channels ?? []).map((c) => ({
      id: c.id,
      clubId: c.club_id,
      name: c.name,
      createdBy: c.created_by,
      createdAt: c.created_at,
    })),
  })
}

// POST /api/school/chat/channels — create a channel (advisor/admin only)
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const clubId = typeof body.clubId === 'string' ? body.clubId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 50) : ''

  if (!clubId || !name) {
    return NextResponse.json({ error: 'clubId and name are required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: club } = await db
    .from('clubs')
    .select('id, advisor_id')
    .eq('id', clubId)
    .eq('school_id', requester.schoolId)
    .maybeSingle()

  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const isAdmin = requester.role === 'admin' || requester.role === 'superadmin'
  const isAdvisor = club.advisor_id === requester.userId

  if (!isAdmin && !isAdvisor) {
    return NextResponse.json(
      { error: 'Only advisors and admins can create channels' },
      { status: 403 },
    )
  }

  const channel = {
    id: `chan-${randomUUID()}`,
    club_id: clubId,
    name,
    created_by: requester.userId,
    created_at: new Date().toISOString(),
  }

  const { error } = await db.from('chat_channels').insert(channel)
  if (error) return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })

  return NextResponse.json({
    channel: {
      id: channel.id,
      clubId: channel.club_id,
      name: channel.name,
      createdBy: channel.created_by,
      createdAt: channel.created_at,
    },
  })
}
