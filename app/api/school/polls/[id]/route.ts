import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/school/polls/[id] { candidateUserId }
 *
 * Cast a vote in a club poll. Routed through the service-role client (not a
 * direct client insert) so the vote persists on the iOS shell, where the
 * Clerk->Supabase JWT bridge is unreliable and the poll_votes RLS insert would
 * silently fail. Mirrors the school-election castVote treatment and the
 * existing `cast_poll_vote` club action. Idempotent (one vote per voter), the
 * voter id is taken from the session, and voting is scoped to the caller's
 * school + an open poll.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: pollId } = await params
  const body = (await req.json().catch(() => null)) as { candidateUserId?: string } | null
  if (!body?.candidateUserId) {
    return NextResponse.json({ error: 'candidateUserId required' }, { status: 400 })
  }

  const db = createServiceClient()

  const [{ data: poll }, { data: user }] = await Promise.all([
    db.from('polls').select('id, club_id, is_open').eq('id', pollId).maybeSingle(),
    db.from('users').select('school_id').eq('id', userId).maybeSingle(),
  ])

  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  if (!poll.is_open) return NextResponse.json({ error: 'This poll is closed' }, { status: 409 })

  // Scope to the caller's school: the poll's club must belong to it.
  const { data: club } = await db
    .from('clubs')
    .select('school_id')
    .eq('id', poll.club_id)
    .maybeSingle()
  if (!club || !user?.school_id || club.school_id !== user.school_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Idempotent — one vote per voter.
  const { count } = await db
    .from('poll_votes')
    .select('*', { count: 'exact', head: true })
    .eq('poll_id', pollId)
    .eq('voter_user_id', userId)
  if ((count ?? 0) === 0) {
    const { error } = await db.from('poll_votes').insert({
      poll_id: pollId,
      candidate_user_id: body.candidateUserId,
      voter_user_id: userId,
    })
    if (error) {
      console.error('poll vote insert failed', error)
      return NextResponse.json({ error: 'Failed to record your vote. Please try again.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
