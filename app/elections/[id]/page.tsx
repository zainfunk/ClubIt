'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import {
  getSchoolElectionById, getPollById, getClubFormById,
  getUserById, getClubById, USERS,
} from '@/lib/mock-data'
import { getVotes, hasVoted, castVote } from '@/lib/election-store'
import { hasResponded, addResponse, getResponseCount } from '@/lib/forms-store'
import Avatar from '@/components/Avatar'
import { ChevronLeft, Clock, CheckCircle2, ClipboardCheck } from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────────────────

function deadlineLabel(closesAt: string | null): string {
  if (!closesAt) return 'No deadline'
  const diff = new Date(closesAt).getTime() - Date.now()
  const hours = Math.round(diff / 36e5)
  if (hours < 0) return 'Closed'
  if (hours < 24) return `Closes in ${hours}h`
  const days = Math.round(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} left`
}

function urgencyColor(closesAt: string | null): string {
  if (!closesAt) return '#727785'
  const diff = new Date(closesAt).getTime() - Date.now()
  const hours = diff / 36e5
  if (hours < 24) return '#EF4444'
  if (hours < 72) return '#F59E0B'
  return '#10B981'
}

const FORM_TYPE_LABEL: Record<string, string> = {
  signup: 'Sign-Up', nomination: 'Nomination', survey: 'Survey', approval: 'Approval',
}

// ── page ───────────────────────────────────────────────────────────────────

export default function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { currentUser } = useMockAuth()

  // Determine item type from ID prefix
  const election = id.startsWith('selec-') ? getSchoolElectionById(id) : null
  const poll = id.startsWith('poll-') ? getPollById(id) : null
  const form = id.startsWith('form-') ? getClubFormById(id) : null

  if (!election && !poll && !form) notFound()

  // ── Election / Poll voting ──────────────────────────────────────────────
  const votingItem = election ?? poll
  const club = (poll ?? form) ? getClubById((poll?.clubId ?? form?.clubId)!) : null

  // voted / storedVotes are read client-side only to avoid hydration mismatch
  const [voted, setVoted] = useState(false)
  const [storedVotes, setStoredVotes] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (votingItem) {
      hasVoted(votingItem.id, currentUser.id).then(setVoted)
      getVotes(votingItem.id).then(setStoredVotes)
    }
  }, [votingItem?.id, currentUser.id])

  // Merge stored votes with mock seed votes
  const mergedCandidates = votingItem ? votingItem.candidates.map((c) => ({
    ...c,
    votes: [...c.votes, ...(storedVotes[c.userId] ?? [])],
  })) : []
  const totalVotes = mergedCandidates.reduce((s, c) => s + c.votes.length, 0)

  // Student confirmation flow: null = none selected, string = pending confirm
  const [pendingCandidate, setPendingCandidate] = useState<string | null>(null)

  function handleSelect(candidateUserId: string) {
    if (!votingItem || voted || !votingItem.isOpen) return
    setPendingCandidate(candidateUserId)
  }

  async function confirmVote() {
    if (!votingItem || !pendingCandidate) return
    await castVote(votingItem.id, pendingCandidate, currentUser.id)
    setVoted(true)
    getVotes(votingItem.id).then(setStoredVotes)
    setPendingCandidate(null)
  }

  function cancelVote() {
    setPendingCandidate(null)
  }

  // ── Form submission ─────────────────────────────────────────────────────
  const [formNote, setFormNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [responseCount, setResponseCount] = useState(0)

  useEffect(() => {
    if (form) {
      hasResponded(form.id, currentUser.id).then(setSubmitted)
      getResponseCount(form.id).then(setResponseCount)
    }
  }, [form?.id, currentUser.id])

  async function handleFormSubmit() {
    if (!form) return
    await addResponse(form.id, currentUser.id)
    setSubmitted(true)
    setResponseCount((n) => n + 1)
  }

  // ── Shared header info ──────────────────────────────────────────────────
  const title = election?.positionTitle ?? poll?.positionTitle ?? form?.title ?? ''
  const description = election?.description ?? form?.description ?? ''
  const isOpen = election?.isOpen ?? poll?.isOpen ?? form?.isOpen ?? false
  const closesAt = form?.closesAt ?? (isOpen ? '2026-04-06T17:00:00Z' : null)
  const color = urgencyColor(closesAt)

  return (
    <div className="space-y-5 max-w-xl">

      {/* Back */}
      <Link href="/elections"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#727785] hover:text-[#191c1d] transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Forms & Elections
      </Link>

      {/* Header card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
        {/* Color bar */}
        <div className="h-1.5 w-full" style={{ background: color }} />

        <div className="px-6 py-5">
          {/* Club + type badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {club && (
              <div className="flex items-center gap-1.5">
                <span className="text-base">{club.iconUrl}</span>
                <span className="text-xs font-semibold text-[#727785]">{club.name}</span>
              </div>
            )}
            {!club && <span className="text-xs font-semibold text-[#727785]">School-wide</span>}
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: form ? 'rgba(146,71,0,0.1)' : 'rgba(0,88,190,0.1)',
                color: form ? '#924700' : '#0058be',
              }}>
              {form ? FORM_TYPE_LABEL[form.formType] : 'Election'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: isOpen ? 'rgba(16,185,129,0.1)' : 'rgba(114,119,133,0.1)',
                color: isOpen ? '#10B981' : '#727785',
              }}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-[#191c1d] mb-2"
            style={{ fontFamily: 'var(--font-manrope, sans-serif)', letterSpacing: '-0.02em' }}>
            {title}
          </h1>

          {/* Description */}
          {description && (
            <p className="text-sm text-[#424754] leading-relaxed mb-4">{description}</p>
          )}

          {/* Deadline */}
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
            <Clock className="w-3.5 h-3.5" />
            {deadlineLabel(closesAt)}
          </div>
        </div>
      </div>

      {/* ── VOTING / RESULTS UI ── */}
      {votingItem && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>

          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Candidates</h2>
            {totalVotes > 0 && currentUser.role !== 'student' && (
              <span className="text-xs text-[#727785]">{totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast</span>
            )}
          </div>

          {mergedCandidates.map((candidate) => {
            const user = getUserById(candidate.userId)
            const pct = totalVotes > 0 ? Math.round((candidate.votes.length / totalVotes) * 100) : 0
            const myVote = candidate.votes.includes(currentUser.id)
            const isViewer = currentUser.role === 'admin' || currentUser.role === 'advisor'
            const showResults = isViewer
            const isPending = pendingCandidate === candidate.userId

            return (
              <div key={candidate.userId}>
                <div className="flex items-center gap-3 mb-2">

                  {/* Left indicator */}
                  {isViewer ? (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: '#f3f4f5', color: '#727785' }}>
                      {mergedCandidates.indexOf(candidate) + 1}
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
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{
                        background: myVote ? '#0058be' : 'transparent',
                        border: myVote ? 'none' : '1px solid #e7e8e9',
                        color: '#ffffff',
                      }}>
                      {myVote ? '✓' : ''}
                    </div>
                  )}

                  <Avatar name={user?.name ?? '?'} size="sm" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#191c1d]"
                      style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                      {user?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-[#727785] capitalize">{user?.role}</p>
                  </div>

                  {showResults && (
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-[#191c1d]">{pct}%</span>
                      {isViewer && (
                        <p className="text-[10px] text-[#727785]">{candidate.votes.length} vote{candidate.votes.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  )}
                </div>

                {showResults && (
                  <div className="ml-9 h-2 rounded-full overflow-hidden" style={{ background: '#f3f4f5' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isViewer ? '#adc6ff' : myVote ? '#0058be' : '#c2c6d6',
                      }} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Student confirmation banner */}
          {pendingCandidate && !voted && currentUser.role === 'student' && (
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(0,88,190,0.06)', border: '1px solid rgba(0,88,190,0.15)' }}>
              <p className="text-sm font-semibold text-[#191c1d] mb-1">
                Confirm your vote for{' '}
                <span style={{ color: '#0058be' }}>{getUserById(pendingCandidate)?.name}</span>?
              </p>
              <p className="text-xs text-[#727785] mb-3">This cannot be changed after you confirm.</p>
              <div className="flex gap-2">
                <button onClick={confirmVote}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: '#0058be' }}>
                  Confirm Vote
                </button>
                <button onClick={cancelVote}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: '#f3f4f5', color: '#424754' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-[#727785] pt-1">
            {currentUser.role !== 'student'
              ? `Live results — ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} recorded.`
              : voted
              ? 'Your vote has been recorded.'
              : votingItem.isOpen
              ? 'Select a candidate, then confirm your vote. You can only vote once.'
              : 'This election is closed.'}
          </p>
        </div>
      )}

      {/* ── FORM SUBMISSION UI ── */}
      {form && (
        <div className="rounded-2xl p-5"
          style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
          {submitted || !form.isOpen ? (
            /* Submitted state */
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
              </div>
              <h2 className="text-lg font-bold text-[#191c1d] mb-1"
                style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                {form.isOpen ? 'Response Submitted!' : 'Form Closed'}
              </h2>
              <p className="text-sm text-[#727785]">
                {form.isOpen
                  ? `Your response has been recorded. ${responseCount} total response${responseCount !== 1 ? 's' : ''} so far.`
                  : 'This form is no longer accepting responses.'}
              </p>
            </div>
          ) : (
            /* Input state */
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mb-4">
                Your Response
              </h2>

              {/* Pre-filled name row */}
              <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
                style={{ background: '#f8f9fa' }}>
                <Avatar name={currentUser.name} size="sm" />
                <div>
                  <p className="text-sm font-bold text-[#191c1d]">{currentUser.name}</p>
                  <p className="text-xs text-[#727785]">{currentUser.email}</p>
                </div>
              </div>

              {/* Note field */}
              <div className="mb-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785] block mb-2">
                  Note <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={3}
                  placeholder="Add any comments or notes for the club advisor…"
                  className="w-full text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#0058be] resize-none"
                  style={{ background: '#f3f4f5', border: 'none' }}
                />
              </div>

              {/* Submit */}
              <button onClick={handleFormSubmit}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#0058be' }}>
                <div className="flex items-center justify-center gap-2">
                  <ClipboardCheck className="w-4 h-4" />
                  Submit Response
                </div>
              </button>

              <p className="text-xs text-[#727785] text-center mt-3">
                {responseCount} response{responseCount !== 1 ? 's' : ''} submitted so far.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
