import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getUserId() {
  const { userId } = await auth()
  return userId ?? null
}

// GET — this user's last-read timestamp per club
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: rows } = await db
    .from('chat_reads')
    .select('club_id, last_read_at')
    .eq('user_id', userId)

  const reads: Record<string, string> = {}
  for (const r of rows ?? []) reads[r.club_id as string] = r.last_read_at as string

  return NextResponse.json({ reads })
}

// POST { clubId } — mark a club's chat as read up to now
export async function POST(request: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const clubId = typeof body.clubId === 'string' ? body.clubId.trim() : ''
  if (!clubId) return NextResponse.json({ error: 'clubId is required' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db
    .from('chat_reads')
    .upsert(
      { user_id: userId, club_id: clubId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,club_id' },
    )
  if (error) return NextResponse.json({ error: 'Failed to update read state' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
