'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import {
  castPollVote,
  castVote,
  hasPollVoted,
  hasVoted,
} from '@/lib/election-store'
import { addResponse, getResponseCount, hasResponded } from '@/lib/forms-store'
import {
  fetchClubFormById,
  fetchClubsByIds,
  fetchPollById,
  fetchSchoolElectionById,
  fetchUsersByIds,
} from '@/lib/school-data'
import { Club, ClubForm, Poll, SchoolElection, User } from '@/types'
import Avatar from '@/components/Avatar'
import { CheckCircle2, ChevronLeft, Clock } from 'lucide-react'

function deadlineLabel(closesAt: string | null, isOpen: boolean): string {
  if (!closesAt) return isOpen ? 'Open now' : 'Closed'
  const diff = new Date(closesAt).getTime() - Date.now()
  const hours = Math.round(diff / 36e5)
  if (hours < 0) return 'Closed'
  if (hours < 24) return `Closes in ${hours}h`
  const days = Math.round(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} left`
}

function urgencyColor(closesAt: string | null, isOpen: boolean): string {
  if (!isOpen) return '#727785'
  if (!closesAt) return '#10B981'
  const diff = new Date(closesAt).getTime() - Date.now()
  const hours = diff / 36e5
  if (hours < 24) return '#EF4444'
  if (hours < 72) return '#F59E0B'
  return '#10B981'
}

const FORM_TYPE_LABEL: Record<string, string> = {
  signup: 'Sign-Up',
  nomination: 'Nomination',
  survey: 'Survey',
  approval: 'Approval',
}

type ItemKind = 'election' | 'poll' | 'form'

export default function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { currentUser } = useMockAuth()
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<ItemKind | null>(null)
  const [election, setElection] = useState<SchoolElection | null>(null)
  const [poll, setPoll] = useState<Poll | null>(null)
  const [form, setForm] = useState<ClubForm | null>(null)
  const [club, setClub] = useState<Club | null>(null)
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [voted, setVoted] = useState(false)
  const [pendingCandidate, setPendingCandidate] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [responseCount, setResponseCount] = useState(0)

  const loadItem = useCallback(async () => {
    if (!currentUser.schoolId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const [nextElection, nextPoll, nextForm] = await Promise.all([
      fetchSchoolElectionById(id, currentUser.schoolId),
      fetchPollById(id, currentUser.schoolId),
      fetchClubFormById(id, currentUser.schoolId),
    ])

    const resolvedKind: ItemKind | null = nextElection ? 'election' : nextPoll ? 'poll' : nextForm ? 'form' : null
    setKind(resolvedKind)
    setElection(nextElection)
    setPoll(nextPoll)
    setForm(nextForm)

    const relatedClubId = nextPoll?.clubId ?? nextForm?.clubId
    if (relatedClubId) {
      const [nextClub] = await fetchClubsByIds([relatedClubId])
      setClub(nextClub ?? null)
    } else {
      setClub(null)
    }

    const candidateIds = nextElection?.candidates.map((candidate) => candidate.userId)
      ?? nextPoll?.candidates.map((candidate) => candidate.userId)
      ?? []
    setUsersById(await fetchUsersByIds(candidateIds))

    if (resolvedKind === 'election' && nextElection) {
      setVoted(await hasVoted(nextElection.id, currentUser.id))
    } else if (resolvedKind === 'poll' && nextPoll) {
      setVoted(await hasPollVoted(nextPoll.id, currentUser.id))
    } else {
      setVoted(false)
    }

    if (resolvedKind === 'form' && nextForm) {
      setSubmitted(await hasResponded(nextForm.id, currentUser.id))
      setResponseCount(await getResponseCount(nextForm.id))
    } else {
      setSubmitted(false)
      setResponseCount(0)
    }

    setPendingCandidate(null)
    setLoading(false)
  }, [currentUser.id, currentUser.schoolId, id])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadItem()
    }, 0)

    return () => {
      clearTimeout(timeout)
    }
  }, [loadItem])

  if (loading) return null
  if (!kind) notFound()

  const votingItem = election ?? poll
  const title = election?.positionTitle ?? poll?.positionTitle ?? form?.title ?? ''
  const description = election?.description ?? form?.description ?? ''
  const isOpen = election?.isOpen ?? poll?.isOpen ?? form?.isOpen ?? false
  const closesAt = form?.closesAt ?? null
  const color = urgencyColor(closesAt, isOpen)
  const candidates = votingItem?.candidates ?? []
  const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes.length, 0)

  function resolveUser(userId: string) {
    return usersById[userId] ?? (currentUser.id === userId ? currentUser : undefined)
  }

  function handleSelect(candidateUserId: string) {
    if (!votingItem || voted || !votingItem.isOpen) return
    setPendingCandidate(candidateUserId)
  }

  async function confirmVote() {
    if (!votingItem || !pendingCandidate) return

    if (kind === 'election') {
      await castVote(votingItem.id, pendingCandidate, currentUser.id)
    } else {
      await castPollVote(votingItem.id, pendingCandidate, currentUser.id)
    }

    await loadItem()
  }

  function cancelVote() {
    setPendingCandidate(null)
  }

  async function handleFormSubmit() {
    if (!form) return
    await addResponse(form.id, currentUser.id)
    setSubmitted(true)
    setResponseCount((count) => count + 1)
  }

  return (
    <div className="space-y-5 max-w-xl">
      <Link
        href="/elections"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#727785] hover:text-[#191c1d] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Forms & Elections
      </Link>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}
      >
        <div className="h-1.5 w-full" style={{ background: color }} />

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {club ? (
              <div className="flex items-center gap-1.5">
                <span className="text-base">{club.iconUrl ?? '📌'}</span>
                <span className="text-xs font-semibold text-[#727785]">{club.name}</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-[#727785]">School-wide</span>
            )}

            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: form ? 'rgba(146,71,0,0.1)' : 'rgba(0,88,190,0.1)',
                color: form ? '#924700' : '#0058be',
              }}
            >
              {form ? FORM_TYPE_LABEL[form.formType] : kind === 'poll' ? 'Club Poll' : 'Election'}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: isOpen ? 'rgba(16,185,129,0.1)' : 'rgba(114,119,133,0.1)',
                color: isOpen ? '#10B981' : '#727785',
              }}
            >
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </div>

          <h1
            className="text-2xl font-bold text-[#191c1d] mb-2"
            style={{ fontFamily: 'var(--font-manrope, sans-serif)', letterSpacing: '-0.02em' }}
          >
            {title}
          </h1>

          {description && (
            <p className="text-sm text-[#424754] leading-relaxed mb-4">{description}</p>
          )}

          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
            <Clock className="w-3.5 h-3.5" />
            {deadlineLabel(closesAt, isOpen)}
          </div>
        </div>
      </div>

      {votingItem && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Candidates</h2>
            {totalVotes > 0 && currentUser.role !== 'student' && (
              <span className="text-xs text-[#727785]">
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast
              </span>
            )}
          </div>

          {candidates.map((candidate, index) => {
            const user = resolveUser(candidate.userId)
            const pct = totalVotes > 0 ? Math.round((candidate.votes.length / totalVotes) * 100) : 0
            const myVote = candidate.votes.includes(currentUser.id)
            const isViewer = currentUser.role === 'admin' || currentUser.role === 'advisor'
            const isPending = pendingCandidate === candidate.userId

            return (
              <div key={candidate.userId}>
                <div className="flex items-center gap-3 mb-2">
                  {isViewer ? (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: '#f3f4f5', color: '#727785' }}
                    >
                      {index + 1}
                    </div>
                  ) : !voted && votingItem.isOpen ? (
                    <button
                      onClick={() => handleSelect(candidate.userId)}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{
                        borderColor: isPending ? '#0058be' : '#c2c6d6',
                        background: isPending ? '#dbeafe' : 'transparent',
                      }}
                      title={`Select ${user?.name}`}
                    >
                      {isPending && <div className="w-2.5 h-2.5 rounded-full bg-[#0058be]" />}
                    </button>
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{
                        background: myVote ? '#0058be' : 'transparent',
                        border: myVote ? 'none' : '1px solid #e7e8e9',
                        color: '#ffffff',
                      }}
                    >
                      {myVote ? '✓' : ''}
                    </div>
                  )}

                  <Avatar name={user?.name ?? '?'} size="sm" />

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-bold text-[#191c1d]"
                      style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
                    >
                      {user?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-[#727785] capitalize">{user?.role}</p>
                  </div>

                  {isViewer && (
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-[#191c1d]">{pct}%</span>
                      <p className="text-[10px] text-[#727785]">
                        {candidate.votes.length} vote{candidate.votes.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>

                {(isViewer || voted) && (
                  <div className="ml-9 h-2 rounded-full overflow-hidden" style={{ background: '#f3f4f5' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isViewer ? '#adc6ff' : myVote ? '#0058be' : '#c2c6d6',
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {pendingCandidate && !voted && currentUser.role === 'student' && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(0,88,190,0.06)', border: '1px solid rgba(0,88,190,0.15)' }}
            >
              <p className="text-sm font-semibold text-[#191c1d] mb-1">
                Confirm your vote for{' '}
                <span style={{ color: '#0058be' }}>{resolveUser(pendingCandidate)?.name}</span>?
              </p>
              <p className="text-xs text-[#727785] mb-3">This cannot be changed after you confirm.</p>
              <div className="flex gap-2">
                <button
                  onClick={confirmVote}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: '#0058be' }}
                >
                  Confirm Vote
                </button>
                <button
                  onClick={cancelVote}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: '#f3f4f5', color: '#424754' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-[#727785] pt-1">
            {currentUser.role !== 'student'
              ? `Live results. ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} recorded.`
              : voted
              ? 'Your vote has been recorded.'
              : votingItem.isOpen
              ? 'Select a candidate, then confirm your vote. You can only vote once.'
              : 'This item is closed.'}
          </p>
        </div>
      )}

      {form && (
        <div
          className="rounded-2xl p-5"
          style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}
        >
          {submitted || !form.isOpen ? (
            <div className="text-center py-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(16,185,129,0.1)' }}
              >
                <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
              </div>
              <h2
                className="text-lg font-bold text-[#191c1d] mb-1"
                style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
              >
                {form.isOpen ? 'Response Submitted!' : 'Form Closed'}
              </h2>
              <p className="text-sm text-[#727785]">
                {form.isOpen
                  ? 'Your response has been saved.'
                  : 'This form is no longer accepting responses.'}
              </p>
              <p className="text-xs text-[#727785] mt-3">
                {responseCount} response{responseCount !== 1 ? 's' : ''} so far
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#424754]">
                Submit your response to count toward this form.
              </p>
              <button
                onClick={handleFormSubmit}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#0058be' }}
              >
                Submit Response
              </button>
              <p className="text-xs text-[#727785] text-center">
                {responseCount} response{responseCount !== 1 ? 's' : ''} so far
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
