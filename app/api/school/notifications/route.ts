import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('notifications fetch error', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }

  return NextResponse.json({
    notifications: (data ?? []).map((n) => ({
      id: n.id,
      userId: n.user_id,
      schoolId: n.school_id ?? undefined,
      type: n.type,
      title: n.title,
      body: n.body ?? undefined,
      link: n.link ?? undefined,
      isRead: n.is_read,
      createdAt: n.created_at,
    })),
  })
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const db = createServiceClient()

  if (body.markAllRead) {
    const { error } = await db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('notifications mark all read error', error)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const { error } = await db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .in('id', body.ids)

    if (error) {
      console.error('notifications mark read error', error)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Provide { ids: string[] } or { markAllRead: true }' }, { status: 400 })
}
