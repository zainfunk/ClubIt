import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { sanitizeText } from '@/lib/sanitize'
import { Role } from '@/types'

export const dynamic = 'force-dynamic'

interface RequesterContext {
  userId: string
  schoolId: string
  role: Role
}

async function getRequester(): Promise<RequesterContext | null> {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!userRow?.school_id) return null

  return {
    userId,
    schoolId: userRow.school_id as string,
    role: userRow.role as Role,
  }
}

// GET — fetch all chat messages for clubs the user has access to
export async function GET() {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  let clubIds: string[]

  if (requester.role === 'admin' || requester.role === 'superadmin') {
    const { data: clubs } = await db
      .from('clubs')
      .select('id')
      .eq('school_id', requester.schoolId)
    clubIds = (clubs ?? []).map((c) => c.id)
  } else {
    const [{ data: advisedClubs }, { data: memberships }] = await Promise.all([
      db.from('clubs').select('id').eq('school_id', requester.schoolId).eq('advisor_id', requester.userId),
      db.from('memberships').select('club_id').eq('user_id', requester.userId),
    ])
    clubIds = Array.from(new Set([
      ...(advisedClubs ?? []).map((c) => c.id),
      ...(memberships ?? []).map((m) => m.club_id),
    ]))
  }

  if (clubIds.length === 0) return NextResponse.json({ messages: [] })

  const { data: messages, error } = await db
    .from('chat_messages')
    .select('*')
    .in('club_id', clubIds)
    .order('sent_at', { ascending: true })

  if (error) {
    console.error('chat messages fetch error', error)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }

  return NextResponse.json({ messages: messages ?? [], accessibleClubIds: clubIds })
}

// POST — send a message to a club
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const clubId = typeof body.clubId === 'string' ? body.clubId.trim() : ''
  const content = typeof body.content === 'string' ? sanitizeText(body.content.trim()) : ''

  if (!clubId || !content) {
    return NextResponse.json({ error: 'clubId and content are required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify club belongs to user's school
  const { data: club } = await db
    .from('clubs')
    .select('id, advisor_id')
    .eq('id', clubId)
    .eq('school_id', requester.schoolId)
    .maybeSingle()

  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  // Check user can send: must be a manager (admin/advisor of club) or a member
  const isManager =
    requester.role === 'admin' ||
    requester.role === 'superadmin' ||
    club.advisor_id === requester.userId

  if (!isManager) {
    const { data: membership } = await db
      .from('memberships')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', requester.userId)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a member of this club to send messages' },
        { status: 403 }
      )
    }
  }

  const message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    club_id: clubId,
    sender_id: requester.userId,
    content,
    sent_at: new Date().toISOString(),
  }

  const { error } = await db.from('chat_messages').insert(message)

  if (error) {
    console.error('chat message insert error', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({
    message: {
      id: message.id,
      clubId: message.club_id,
      senderId: message.sender_id,
      content: message.content,
      sentAt: message.sent_at,
    },
  })
}
