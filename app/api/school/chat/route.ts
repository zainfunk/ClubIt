import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { sanitizeText } from '@/lib/sanitize'
import { checkContent, censorProfanity } from '@/lib/content-filter'
import { chatLimiter } from '@/lib/rate-limit'
import { sendPushToUser, pushConfigured } from '@/lib/push-send'
import { Role } from '@/types'
import { randomUUID } from 'node:crypto'

// node runtime: the push sender (lib/push-send.ts) uses node:http2 + node:crypto.
export const runtime = 'nodejs'
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

  // Hide messages from users this requester has blocked (Guideline 1.2).
  const { data: blocks } = await db
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', requester.userId)
  const blockedIds = new Set((blocks ?? []).map((b) => b.blocked_id))
  const visible = (messages ?? []).filter((m) => !blockedIds.has(m.sender_id))

  return NextResponse.json({ messages: visible, accessibleClubIds: clubIds })
}

// POST — send a message to a club
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await chatLimiter.check(`user:${requester.userId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'You are sending messages too quickly. Please slow down.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const body = await request.json()
  const clubId = typeof body.clubId === 'string' ? body.clubId.trim() : ''
  const rawContent = typeof body.content === 'string' ? sanitizeText(body.content.trim()) : ''

  if (!clubId || !rawContent) {
    return NextResponse.json({ error: 'clubId and content are required' }, { status: 400 })
  }

  // Two-tier moderation (Guideline 1.2):
  //  1. Hard block: unambiguous slurs / explicit sexual language are rejected
  //     before storage so they never reach another student.
  //  2. Profanity censor: ordinary swearing is masked in place ("damn" ->
  //     "****") and the message still goes through. Censoring happens
  //     server-side so the cleaned text is what gets stored and broadcast —
  //     clients can never render the uncensored original.
  const check = checkContent(rawContent)
  if (!check.ok) {
    console.warn(`chat: blocked message from ${requester.userId} (term: ${check.matched})`)
    return NextResponse.json(
      { error: 'Your message was blocked because it violates our community guidelines.' },
      { status: 422 },
    )
  }

  const content = censorProfanity(rawContent).text

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
    id: `msg-${randomUUID()}`,
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

  // Notify other members of the club (best-effort). Guarded by pushConfigured()
  // so it's a complete no-op — not even a DB read — until APNs is set up.
  if (pushConfigured()) {
    try {
      const { data: members } = await db
        .from('memberships')
        .select('user_id')
        .eq('club_id', clubId)
      const recipientIds = new Set((members ?? []).map((m) => m.user_id as string))
      if (club.advisor_id) recipientIds.add(club.advisor_id as string)
      recipientIds.delete(requester.userId)
      const snippet = content.length > 120 ? content.slice(0, 117) + '…' : content
      await Promise.all(
        [...recipientIds].map((rid) =>
          sendPushToUser(rid, { title: 'New message', body: snippet, path: `/chat/${clubId}` }),
        ),
      )
    } catch (e) {
      console.error('chat push notify failed', e)
    }
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
