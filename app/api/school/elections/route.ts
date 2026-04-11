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

type ElectionRow = {
  id: string
  position_title: string
  description: string | null
  created_at: string
  is_open: boolean
  election_candidates: { user_id: string }[]
  election_votes: { candidate_user_id: string; voter_user_id: string }[]
}

function rowToElection(row: ElectionRow): SchoolElection {
  return {
    id: row.id,
    positionTitle: row.position_title,
    description: row.description ?? '',
    createdAt: row.created_at,
    isOpen: row.is_open,
    candidates: row.election_candidates.map((c) => ({
      userId: c.user_id,
      votes: row.election_votes
        .filter((v) => v.candidate_user_id === c.user_id)
        .map((v) => v.voter_user_id),
    })),
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

  const elections = (data as ElectionRow[] | null)?.map(rowToElection) ?? []
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

  const positionTitle = body.positionTitle?.trim()
  const description = body.description?.trim() ?? ''
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

  const election: SchoolElection = {
    id,
    positionTitle,
    description,
    createdAt,
    isOpen: true,
    candidates: candidateUserIds.map((uid) => ({ userId: uid, votes: [] })),
  }

  return NextResponse.json({ election })
}
