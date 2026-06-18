import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { sanitizeText } from '@/lib/sanitize'
import { randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'

// POST /api/school/chat/report — flag a chat message as objectionable.
// Part of the Guideline 1.2 UGC moderation loop; reports surface to admins.
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()
  if (!userRow?.school_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : ''
  const reason = typeof body.reason === 'string' ? sanitizeText(body.reason.trim()).slice(0, 500) : ''
  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  }

  // Confirm the message exists (the report cascades with it if it's removed).
  const { data: message } = await db
    .from('chat_messages')
    .select('id')
    .eq('id', messageId)
    .maybeSingle()
  if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  const { error } = await db.from('chat_message_reports').insert({
    id: `rpt-${randomUUID()}`,
    message_id: messageId,
    reporter_id: userId,
    school_id: userRow.school_id,
    reason: reason || null,
    status: 'open',
  })
  if (error) {
    console.error('chat report insert error', error)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }

  return NextResponse.json({ status: 'reported' })
}
