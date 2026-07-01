import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fixed reaction palette. Kept server-side so clients can't store arbitrary
// strings as "emoji".
const ALLOWED_EMOJI = new Set(['❤️', '👍', '😂', '😮', '😢', '🙏'])

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

type Requester = { userId: string; schoolId: string; role: Role }

// Can this requester read/react in the given channel? Admins and the club's
// advisor always can; everyone else must be an explicit channel member.
async function canAccessChannel(
  db: ReturnType<typeof createServiceClient>,
  requester: Requester,
  channelId: string,
): Promise<boolean> {
  const { data: channel } = await db
    .from('chat_channels')
    .select('id, club_id')
    .eq('id', channelId)
    .maybeSingle()
  if (!channel) return false

  const { data: club } = await db
    .from('clubs')
    .select('id, advisor_id')
    .eq('id', channel.club_id)
    .eq('school_id', requester.schoolId)
    .maybeSingle()
  if (!club) return false

  if (
    requester.role === 'admin' ||
    requester.role === 'superadmin' ||
    club.advisor_id === requester.userId
  ) {
    return true
  }

  const { data: member } = await db
    .from('chat_channel_members')
    .select('user_id')
    .eq('channel_id', channelId)
    .eq('user_id', requester.userId)
    .maybeSingle()
  return !!member
}

// GET ?clubId=X — all reactions on messages in channels this user can read
export async function GET(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clubId = new URL(request.url).searchParams.get('clubId')
  if (!clubId) return NextResponse.json({ error: 'clubId is required' }, { status: 400 })

  const db = createServiceClient()

  // Channels of this club the requester can read.
  const { data: club } = await db
    .from('clubs')
    .select('id, advisor_id')
    .eq('id', clubId)
    .eq('school_id', requester.schoolId)
    .maybeSingle()
  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const { data: channels } = await db.from('chat_channels').select('id').eq('club_id', clubId)
  let channelIds = (channels ?? []).map((c) => c.id as string)

  const isManager =
    requester.role === 'admin' ||
    requester.role === 'superadmin' ||
    club.advisor_id === requester.userId

  if (!isManager) {
    const { data: memberRows } = await db
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', requester.userId)
    const memberSet = new Set((memberRows ?? []).map((r) => r.channel_id as string))
    channelIds = channelIds.filter((id) => memberSet.has(id))
  }

  if (channelIds.length === 0) return NextResponse.json({ reactions: [] })

  const { data: msgs } = await db.from('chat_messages').select('id').in('channel_id', channelIds)
  const messageIds = (msgs ?? []).map((m) => m.id as string)
  if (messageIds.length === 0) return NextResponse.json({ reactions: [] })

  const { data: rows } = await db
    .from('chat_message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', messageIds)

  return NextResponse.json({
    reactions: (rows ?? []).map((r) => ({
      messageId: r.message_id as string,
      userId: r.user_id as string,
      emoji: r.emoji as string,
    })),
  })
}

// POST { messageId, emoji } — add a reaction
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : ''
  const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : ''
  if (!messageId || !emoji) return NextResponse.json({ error: 'messageId and emoji are required' }, { status: 400 })
  if (!ALLOWED_EMOJI.has(emoji)) return NextResponse.json({ error: 'Unsupported reaction' }, { status: 400 })

  const db = createServiceClient()
  const { data: message } = await db
    .from('chat_messages')
    .select('id, channel_id')
    .eq('id', messageId)
    .maybeSingle()
  if (!message?.channel_id) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  if (!(await canAccessChannel(db, requester, message.channel_id as string))) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { error } = await db.from('chat_message_reactions').upsert(
    { message_id: messageId, user_id: requester.userId, emoji, created_at: new Date().toISOString() },
    { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true },
  )
  if (error) return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE { messageId, emoji } — remove a reaction
export async function DELETE(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : ''
  const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : ''
  if (!messageId || !emoji) return NextResponse.json({ error: 'messageId and emoji are required' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from('chat_message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', requester.userId)
    .eq('emoji', emoji)
  if (error) return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
