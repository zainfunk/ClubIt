import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Admin moderation queue (App Store Guideline 1.2): lets a school admin review
// reported chat messages and act on them — remove the message or dismiss the
// report — so objectionable content can be handled within 24 hours.

async function getAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()
  if (!userRow?.school_id) return null
  if (userRow.role !== 'admin' && userRow.role !== 'superadmin') return null
  return { userId, schoolId: userRow.school_id as string }
}

export async function GET() {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data: reports } = await db
    .from('chat_message_reports')
    .select('id, message_id, reporter_id, reason, status, created_at')
    .eq('school_id', admin.schoolId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const rows = reports ?? []
  // Hydrate message content + author names + reporter names in bulk.
  const messageIds = Array.from(new Set(rows.map((r) => r.message_id).filter(Boolean)))
  const userIds = Array.from(new Set(rows.map((r) => r.reporter_id).filter(Boolean)))

  const [{ data: messages }, { data: users }] = await Promise.all([
    messageIds.length
      ? db.from('chat_messages').select('id, content, sender_id, club_id').in('id', messageIds)
      : Promise.resolve({ data: [] as { id: string; content: string; sender_id: string; club_id: string }[] }),
    db.from('users').select('id, name'),
  ])

  const msgById = new Map((messages ?? []).map((m) => [m.id, m]))
  const nameById = new Map((users ?? []).map((u) => [u.id, u.name]))
  // Pull sender names too.
  for (const m of messages ?? []) {
    if (m.sender_id && !nameById.has(m.sender_id)) nameById.set(m.sender_id, 'Unknown')
  }

  const enriched = rows.map((r) => {
    const m = r.message_id ? msgById.get(r.message_id) : undefined
    return {
      id: r.id,
      reason: r.reason,
      createdAt: r.created_at,
      reporterName: r.reporter_id ? nameById.get(r.reporter_id) ?? 'Unknown' : 'Unknown',
      messageId: r.message_id,
      content: m?.content ?? '(message already removed)',
      authorName: m?.sender_id ? nameById.get(m.sender_id) ?? 'Unknown' : 'Unknown',
      removed: !m,
    }
  })

  return NextResponse.json({ reports: enriched })
}

export async function POST(request: NextRequest) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const reportId = typeof body.reportId === 'string' ? body.reportId : ''
  const action = body.action as 'remove' | 'dismiss'
  if (!reportId || (action !== 'remove' && action !== 'dismiss')) {
    return NextResponse.json({ error: 'reportId and a valid action are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: report } = await db
    .from('chat_message_reports')
    .select('id, message_id, school_id')
    .eq('id', reportId)
    .maybeSingle()
  if (!report || report.school_id !== admin.schoolId) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  if (action === 'remove' && report.message_id) {
    // Deleting the message cascades its reports away (Guideline 1.2: act on the
    // content). Other reports of the same message resolve with it.
    await db.from('chat_messages').delete().eq('id', report.message_id)
  } else {
    await db.from('chat_message_reports').update({ status: 'dismissed' }).eq('id', reportId)
  }

  return NextResponse.json({ status: action === 'remove' ? 'removed' : 'dismissed' })
}
