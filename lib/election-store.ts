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
  electionId: string, candidateUserId: string, voterId: string
): Promise<void> {
  if (await hasVoted(electionId, voterId)) return
  await supabase.from('election_votes').insert({
    election_id: electionId,
    candidate_user_id: candidateUserId,
    voter_user_id: voterId,
  })
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
  pollId: string, candidateUserId: string, voterId: string
): Promise<void> {
  if (await hasPollVoted(pollId, voterId)) return
  await supabase.from('poll_votes').insert({
    poll_id: pollId,
    candidate_user_id: candidateUserId,
    voter_user_id: voterId,
  })
}
