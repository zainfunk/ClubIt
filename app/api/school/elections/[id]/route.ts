import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role, SchoolElection } from '@/types'

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

  return {
    userId,
    schoolId: userRow.school_id as string,
    role: userRow.role as Role,
  }
}

type ElectionDetailRow = {
  id: string
  position_title: string
  description: string | null
  created_at: string
  is_open: boolean
  school_id: string
  election_candidates: { user_id: string }[]
  election_votes: { candidate_user_id: string; voter_user_id: string }[]
}

// W2.2 secret ballot: counts + the caller's own-vote pointer are computed
// server-side; voter_user_id is never serialized to the browser.
function rowToElection(row: ElectionDetailRow, callerId: string): SchoolElection {
  const counts = new Map<string, number>()
  for (const v of row.election_votes) {
    counts.set(v.candidate_user_id, (counts.get(v.candidate_user_id) ?? 0) + 1)
  }
  const myVote = row.election_votes.find((v) => v.voter_user_id === callerId)
  return {
    id: row.id,
    positionTitle: row.position_title,
    description: row.description ?? '',
    createdAt: row.created_at,
    isOpen: row.is_open,
    candidates: row.election_candidates.map((c) => ({
      userId: c.user_id,
      voteCount: counts.get(c.user_id) ?? 0,
    })),
    myVoteCandidateId: myVote?.candidate_user_id ?? null,
  }
}

// GET — single election detail for the caller's school. Any authenticated
// member of the school may read. Routed through the service role so it works
// on the iOS shell, where the Clerk->Supabase JWT bridge (and thus client-side
// RLS reads) is unreliable.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('school_elections')
    .select('id, position_title, description, created_at, is_open, school_id, election_candidates(user_id), election_votes(candidate_user_id, voter_user_id)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('election detail error', error)
    return NextResponse.json({ error: 'Failed to load election' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Election not found' }, { status: 404 })

  const row = data as ElectionDetailRow
  if (requester.role !== 'superadmin' && row.school_id !== requester.schoolId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ election: rowToElection(row, requester.userId) })
}

// POST — cast a vote in this election. Service-role + server-side validation
// (open election, same school, valid candidate, one vote per voter) so votes
// actually persist on the iOS shell instead of being silently dropped by RLS
// when the client Clerk->Supabase token bridge is absent. Mirrors the
// election_votes_insert RLS check from migration 0004 (secret ballot).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { candidateUserId?: string }
  const candidateUserId = body.candidateUserId
  if (!candidateUserId) {
    return NextResponse.json({ error: 'candidateUserId is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: election } = await db
    .from('school_elections')
    .select('id, school_id, is_open, election_candidates(user_id)')
    .eq('id', id)
    .maybeSingle()

  if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  if (requester.role !== 'superadmin' && election.school_id !== requester.schoolId) {
    return NextResponse.json({ error: 'You can only vote in your own school' }, { status: 403 })
  }
  if (!election.is_open) {
    return NextResponse.json({ error: 'This election is closed' }, { status: 409 })
  }

  const validCandidate = (election.election_candidates as { user_id: string }[]).some(
    (c) => c.user_id === candidateUserId
  )
  if (!validCandidate) {
    return NextResponse.json({ error: 'That candidate is not in this election' }, { status: 400 })
  }

  // One vote per voter: idempotent — a repeat tap returns the existing vote.
  const { data: existingVote } = await db
    .from('election_votes')
    .select('candidate_user_id')
    .eq('election_id', id)
    .eq('voter_user_id', requester.userId)
    .maybeSingle()

  if (existingVote) {
    return NextResponse.json({ ok: true, myVoteCandidateId: existingVote.candidate_user_id })
  }

  const { error } = await db.from('election_votes').insert({
    election_id: id,
    candidate_user_id: candidateUserId,
    voter_user_id: requester.userId,
  })

  if (error) {
    console.error('election vote insert error', error)
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, myVoteCandidateId: candidateUserId })
}

// PATCH — toggle is_open (close/reopen). Admin only, same-school only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as { isOpen?: boolean }

  if (typeof body.isOpen !== 'boolean') {
    return NextResponse.json({ error: 'isOpen (boolean) is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('school_elections')
    .select('school_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  if (requester.role !== 'superadmin' && existing.school_id !== requester.schoolId) {
    return NextResponse.json({ error: 'You can only manage elections in your own school' }, { status: 403 })
  }

  const { error } = await db
    .from('school_elections')
    .update({ is_open: body.isOpen })
    .eq('id', id)

  if (error) {
    console.error('election update error', error)
    return NextResponse.json({ error: 'Failed to update election' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, isOpen: body.isOpen })
}
