import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { notifyElectionOpened } from '@/lib/notify'
import { Role, SchoolElection } from '@/types'
import { sanitizeText } from '@/lib/sanitize'

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

type ElectionRow = {
  id: string
  position_title: string
  description: string | null
  created_at: string
  is_open: boolean
  election_candidates: { user_id: string }[]
  election_votes: { candidate_user_id: string; voter_user_id: string }[]
}

// W2.2 secret ballot: aggregate counts and the caller's own vote pointer
// computed server-side; voter_user_id never serialized to the browser.
function rowToElection(row: ElectionRow, callerId: string): SchoolElection {
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

// GET — list all elections for the caller's school. Any authenticated member can read.
export async function GET() {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('school_elections')
    .select('id, position_title, description, created_at, is_open, election_candidates(user_id), election_votes(candidate_user_id, voter_user_id)')
    .eq('school_id', requester.schoolId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('elections list error', error)
    return NextResponse.json({ error: 'Failed to load elections' }, { status: 500 })
  }

  const elections = (data as ElectionRow[] | null)?.map((row) => rowToElection(row, requester.userId)) ?? []
  return NextResponse.json({ elections })
}

// POST — create a new election. Admin only.
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as {
    positionTitle?: string
    description?: string
    candidateUserIds?: string[]
  }

  const positionTitle = body.positionTitle?.trim() ? sanitizeText(body.positionTitle.trim()) : undefined
  const description = body.description?.trim() ? sanitizeText(body.description.trim()) : ''
  const candidateUserIds = body.candidateUserIds ?? []

  if (!positionTitle) {
    return NextResponse.json({ error: 'positionTitle is required' }, { status: 400 })
  }
  if (candidateUserIds.length < 2) {
    return NextResponse.json({ error: 'Need at least two candidates' }, { status: 400 })
  }

  const db = createServiceClient()

  // Confirm all candidates belong to this school so an admin can't pull in outside users.
  const { data: candidateRows, error: candidateError } = await db
    .from('users')
    .select('id')
    .in('id', candidateUserIds)
    .eq('school_id', requester.schoolId)

  if (candidateError) {
    return NextResponse.json({ error: 'Failed to verify candidates' }, { status: 500 })
  }
  if ((candidateRows?.length ?? 0) !== candidateUserIds.length) {
    return NextResponse.json({ error: 'One or more candidates are not in this school' }, { status: 400 })
  }

  const id = `selec-${Date.now()}`
  const createdAt = new Date().toISOString()

  const { error: insertError } = await db
    .from('school_elections')
    .insert({
      id,
      school_id: requester.schoolId,
      position_title: positionTitle,
      description,
      created_at: createdAt,
      is_open: true,
    })

  if (insertError) {
    console.error('election insert error', insertError)
    return NextResponse.json({ error: 'Failed to create election' }, { status: 500 })
  }

  const { error: candidatesInsertError } = await db
    .from('election_candidates')
    .insert(candidateUserIds.map((uid) => ({ election_id: id, user_id: uid })))

  if (candidatesInsertError) {
    console.error('election candidates insert error', candidatesInsertError)
    return NextResponse.json({ error: 'Failed to save candidates' }, { status: 500 })
  }

  // Tell the school a vote is open, after the response is sent.
  after(() =>
    notifyElectionOpened({
      schoolId: requester.schoolId,
      electionId: id,
      positionTitle,
      creatorId: requester.userId,
    }),
  )

  const election: SchoolElection = {
    id,
    positionTitle,
    description,
    createdAt,
    isOpen: true,
    candidates: candidateUserIds.map((uid) => ({ userId: uid, voteCount: 0 })),
    myVoteCandidateId: null,
  }

  return NextResponse.json({ election })
}
