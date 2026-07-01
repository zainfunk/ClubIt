import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

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

// Resolve the channel and confirm the requester may manage its membership.
// Only the club's advisor and admins can add/remove members.
async function loadManageableChannel(channelId: string, requester: { userId: string; schoolId: string; role: Role }) {
  const db = createServiceClient()
  const { data: channel } = await db
    .from('chat_channels')
    .select('id, club_id')
    .eq('id', channelId)
    .maybeSingle()
  if (!channel) return { error: NextResponse.json({ error: 'Channel not found' }, { status: 404 }) }

  const { data: club } = await db
    .from('clubs')
    .select('id, advisor_id')
    .eq('id', channel.club_id)
    .eq('school_id', requester.schoolId)
    .maybeSingle()
  if (!club) return { error: NextResponse.json({ error: 'Channel not found' }, { status: 404 }) }

  const canManage =
    requester.role === 'admin' ||
    requester.role === 'superadmin' ||
    club.advisor_id === requester.userId

  if (!canManage) {
    return { error: NextResponse.json({ error: 'Only advisors and admins can manage members' }, { status: 403 }) }
  }
  return { channel, club }
}

// GET ?channelId=X — list members of a channel (managers only)
export async function GET(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelId = new URL(request.url).searchParams.get('channelId')
  if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })

  const result = await loadManageableChannel(channelId, requester)
  if ('error' in result) return result.error

  const db = createServiceClient()
  const { data: rows } = await db
    .from('chat_channel_members')
    .select('user_id')
    .eq('channel_id', channelId)

  return NextResponse.json({ memberIds: (rows ?? []).map((r) => r.user_id as string) })
}

// POST { channelId, userId } — add a member (managers only)
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : ''
  const targetId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!channelId || !targetId) {
    return NextResponse.json({ error: 'channelId and userId are required' }, { status: 400 })
  }

  const result = await loadManageableChannel(channelId, requester)
  if ('error' in result) return result.error

  const db = createServiceClient()

  // The target must be a real user in the same school.
  const { data: target } = await db
    .from('users')
    .select('id, school_id')
    .eq('id', targetId)
    .maybeSingle()
  if (!target || target.school_id !== requester.schoolId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error } = await db.from('chat_channel_members').upsert(
    {
      channel_id: channelId,
      user_id: targetId,
      added_by: requester.userId,
      added_at: new Date().toISOString(),
    },
    { onConflict: 'channel_id,user_id', ignoreDuplicates: true },
  )
  if (error) return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE { channelId, userId } — remove a member (managers only)
export async function DELETE(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : ''
  const targetId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!channelId || !targetId) {
    return NextResponse.json({ error: 'channelId and userId are required' }, { status: 400 })
  }

  const result = await loadManageableChannel(channelId, requester)
  if ('error' in result) return result.error

  const db = createServiceClient()
  const { error } = await db
    .from('chat_channel_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', targetId)
  if (error) return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
