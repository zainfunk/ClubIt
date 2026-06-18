import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Per-user blocking for chat (App Store Guideline 1.2). A blocker stops seeing
// the blocked user's messages (enforced in GET /api/school/chat).

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createServiceClient()
  const { data } = await db
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
  return NextResponse.json({ blockedIds: (data ?? []).map((b) => b.blocked_id) })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const blockedId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!blockedId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (blockedId === userId) {
    return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('user_blocks')
    .upsert(
      { blocker_id: userId, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    )
  if (error) {
    console.error('user block insert error', error)
    return NextResponse.json({ error: 'Failed to block user' }, { status: 500 })
  }
  return NextResponse.json({ status: 'blocked' })
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const blockedId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!blockedId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const db = createServiceClient()
  await db.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId)
  return NextResponse.json({ status: 'unblocked' })
}
