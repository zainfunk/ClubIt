import { supabase } from '@/lib/supabase'

export async function getVotes(electionId: string): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from('election_votes')
    .select('candidate_user_id, voter_user_id')
    .eq('election_id', electionId)
  const map: Record<string, string[]> = {}
  for (const row of data ?? []) {
    if (!map[row.candidate_user_id]) map[row.candidate_user_id] = []
    map[row.candidate_user_id].push(row.voter_user_id)
  }
  return map
}

export async function hasVoted(electionId: string, voterId: string): Promise<boolean> {
  const { count } = await supabase
    .from('election_votes')
    .select('*', { count: 'exact', head: true })
    .eq('election_id', electionId)
    .eq('voter_user_id', voterId)
  return (count ?? 0) > 0
}

export async function castVote(
  electionId: string, candidateUserId: string, _voterId?: string
): Promise<void> {
  // Routed through the service-role server endpoint (not a direct client
  // insert) so the vote persists on the iOS shell, where the Clerk->Supabase
  // JWT bridge is unreliable and the election_votes RLS insert would silently
  // fail. The server validates open/same-school/valid-candidate and enforces
  // one vote per voter. _voterId is derived server-side from the session.
  const res = await fetch(`/api/school/elections/${electionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateUserId }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Vote failed (${res.status})`)
  }
}

// Poll votes (club-level)
export async function getPollVotes(pollId: string): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from('poll_votes')
    .select('candidate_user_id, voter_user_id')
    .eq('poll_id', pollId)
  const map: Record<string, string[]> = {}
  for (const row of data ?? []) {
    if (!map[row.candidate_user_id]) map[row.candidate_user_id] = []
    map[row.candidate_user_id].push(row.voter_user_id)
  }
  return map
}

export async function hasPollVoted(pollId: string, voterId: string): Promise<boolean> {
  const { count } = await supabase
    .from('poll_votes')
    .select('*', { count: 'exact', head: true })
    .eq('poll_id', pollId)
    .eq('voter_user_id', voterId)
  return (count ?? 0) > 0
}

export async function castPollVote(
  pollId: string, candidateUserId: string, _voterId?: string
): Promise<void> {
  // Routed through the service-role server endpoint (not a direct client
  // insert) so the vote persists on the iOS shell, where the Clerk->Supabase
  // JWT bridge is unreliable and the poll_votes RLS insert would silently fail.
  // The server validates open/same-school and enforces one vote per voter,
  // derived from the session. Mirrors castVote for school elections.
  const res = await fetch(`/api/school/polls/${pollId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateUserId }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Vote failed (${res.status})`)
  }
}
