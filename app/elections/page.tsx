'use client'

import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import { hasPollVoted, hasVoted } from '@/lib/election-store'
import { hasResponded } from '@/lib/forms-store'
import { useState, useEffect } from 'react'
import { SchoolElection, Poll } from '@/types'
import { Vote, FileText, ClipboardList, Clock, ChevronRight, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'

// ── helpers ────────────────────────────────────────────────────────────────

function deadlineLabel(closesAt: string | null): string {
  if (!closesAt) return 'No deadline'
  const diff = new Date(closesAt).getTime() - Date.now()
  const hours = Math.round(diff / 36e5)
  if (hours < 0) return 'Closed'
  if (hours < 24) return `${hours}h left`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Closes tomorrow'
  return `${days} days left`
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

const FORM_TYPE_COLOR: Record<string, string> = {
  signup: 'rgba(16,185,129,0.1)', nomination: 'rgba(59,130,246,0.1)',
  survey: 'rgba(146,71,0,0.1)', approval: 'rgba(239,68,68,0.1)',
}
const FORM_TYPE_TEXT: Record<string, string> = {
  signup: '#10B981', nomination: '#3B82F6', survey: '#924700', approval: '#EF4444',
}

// ── component ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'elections' | 'forms'

export default function FormsPage() {
  const { currentUser, devRole } = useMockAuth()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [schoolElections, setSchoolElections] = useState<SchoolElection[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [clubForms, setClubForms] = useState<import('@/types').ClubForm[]>([])
  const [clubNames, setClubNames] = useState<Record<string, { name: string; iconUrl?: string }>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser.schoolId) return
    setIsLoading(true)
    setLoadError(null)

    let cancelled = false

    async function load() {
      try {
        // Load school-wide elections via the server API (works regardless of RLS).
        const elRes = await fetch('/api/school/elections', { cache: 'no-store' })
        if (elRes.ok) {
          const data = await elRes.json()
          if (!cancelled && data?.elections) setSchoolElections(data.elections as SchoolElection[])
        }

        // Load club polls, forms, and club names for this school's clubs
        const { data: clubData } = await supabase.from('clubs').select('id, name, icon_url').eq('school_id', currentUser.schoolId)
        const schoolClubIds = (clubData ?? []).map((c) => c.id)
        if (cancelled) return
        if (schoolClubIds.length === 0) return

        // Build club name map
        const nameMap: Record<string, { name: string; iconUrl?: string }> = {}
        for (const c of clubData ?? []) nameMap[c.id] = { name: c.name, iconUrl: c.icon_url ?? undefined }
        setClubNames(nameMap)

        // Load club forms
        const { data: formData } = await supabase.from('club_forms').select('*').in('club_id', schoolClubIds)
        if (!cancelled && formData) setClubForms(formData.map((f) => ({
          id: f.id, clubId: f.club_id, title: f.title, description: f.description ?? '',
          formType: f.form_type, isOpen: f.is_open, closesAt: f.closes_at ?? null, createdAt: f.created_at,
        })))

        const { data: memData } = await supabase.from('memberships').select('club_id').eq('user_id', currentUser.id)
        if (cancelled) return
        const myClubIds = (memData ?? []).map((r) => r.club_id)
        const pollClubIds = (devRole === 'advisor' || devRole === 'admin') ? schoolClubIds : myClubIds.filter((id) => schoolClubIds.includes(id))
        if (pollClubIds.length > 0) {
          const { data: pollData } = await supabase.from('polls').select('*, poll_candidates(*), poll_votes(*)').in('club_id', pollClubIds)
          if (!cancelled && pollData) setPolls(pollData.map((p) => ({
            id: p.id, clubId: p.club_id, positionTitle: p.position_title,
            createdAt: p.created_at, isOpen: p.is_open,
            candidates: (p.poll_candidates as {user_id: string}[]).map((c) => ({
              userId: c.user_id,
              votes: (p.poll_votes as {candidate_user_id: string; voter_user_id: string}[])
                .filter((v) => v.candidate_user_id === c.user_id).map((v) => v.voter_user_id),
            })),
          })))
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load elections data')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [currentUser.schoolId, currentUser.id, devRole])

  const openElections = schoolElections.filter((e) => e.isOpen)
  const closedElections = schoolElections.filter((e) => !e.isOpen)
  const openPolls = polls.filter((p) => p.isOpen)

  const openForms = clubForms.filter((f) => f.isOpen)
  const closedForms = clubForms.filter((f) => !f.isOpen)

  const urgentElection = openElections[0] ?? null

  useEffect(() => {
    const allChecks = [
      ...openElections.map((e) => hasVoted(e.id, currentUser.id).then((v) => v ? e.id : null)),
      ...openPolls.map((p) => hasPollVoted(p.id, currentUser.id).then((v) => v ? p.id : null)),
      ...openForms.map((f) => hasResponded(f.id, currentUser.id).then((v) => v ? f.id : null)),
    ]
    Promise.all(allChecks).then((results) => {
      setDoneIds(new Set(results.filter(Boolean) as string[]))
    })
  }, [currentUser.id, openElections.length, openPolls.length])

  // Merged active list for filtered view
  type ListItem = { id: string; kind: 'election' | 'poll' | 'form'; title: string; subtitle?: string; description?: string; closesAt: string | null; clubId?: string; done: boolean; formType?: string }

  const allActive: ListItem[] = [
    ...openElections.map((e) => ({
      id: e.id, kind: 'election' as const,
      title: e.positionTitle, subtitle: 'School-wide Election',
      description: e.description, closesAt: null,
      done: doneIds.has(e.id),
    })),
    ...openPolls.map((p) => {
      const club = clubNames[p.clubId]
      return {
        id: p.id, kind: 'poll' as const,
        title: p.positionTitle, subtitle: club?.name,
        closesAt: null, clubId: p.clubId,
        done: doneIds.has(p.id),
      }
    }),
    ...openForms.map((f) => {
      const club = clubNames[f.clubId]
      return {
        id: f.id, kind: 'form' as const,
        title: f.title, subtitle: club?.name,
        description: f.description, closesAt: f.closesAt,
        clubId: f.clubId, formType: f.formType,
        done: doneIds.has(f.id),
      }
    }),
  ]

  const filtered = filter === 'all' ? allActive
    : filter === 'elections' ? allActive.filter((i) => i.kind === 'election' || i.kind === 'poll')
    : allActive.filter((i) => i.kind === 'form')

  const totalOpen = allActive.length
  const totalDone = allActive.filter((i) => i.done).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Page header ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mb-1">Civic Engagement</p>
        <h1 className="text-3xl font-bold text-[#191c1d]"
          style={{ fontFamily: 'var(--font-manrope, sans-serif)', letterSpacing: '-0.02em' }}>
          Forms & Elections
        </h1>
        <p className="text-sm text-[#727785] mt-1">Participate in active elections and club decisions.</p>
      </div>

      {/* ── Error banner ── */}
      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load elections</p>
            <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
          </div>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-red-700 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl p-4 bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <Skeleton className="h-4 w-4 mx-auto mb-2 rounded-full" />
                <Skeleton className="h-6 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-5" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <>

      {/* ── Urgent election hero card ── */}
      {urgentElection && !doneIds.has(urgentElection.id) && (
        <div className="rounded-2xl overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)', boxShadow: '0 8px 32px rgba(0,88,190,0.25)' }}>
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1">Active Now</p>
                <h2 className="text-xl font-bold text-white leading-tight mb-1"
                  style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                  {urgentElection.positionTitle}
                </h2>
                <p className="text-sm text-blue-100 leading-relaxed mb-4">
                  {urgentElection.description}
                </p>
                <div className="flex items-center gap-2 text-blue-200 text-xs mb-4">
                  <Clock className="w-3.5 h-3.5" />
                  School-wide election is open now
                </div>
                <Link href={`/elections/${urgentElection.id}`}>
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0058be] bg-white transition-all hover:bg-blue-50">
                    {currentUser.role === 'student' ? 'Cast Your Vote' : 'View Details'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
              <div className="shrink-0 opacity-20">
                <Vote className="w-20 h-20 text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <ClipboardList className="w-4 h-4" />, value: totalOpen, label: 'Active Items', color: '#0058be' },
          { icon: <CheckCircle2 className="w-4 h-4" />, value: totalDone, label: 'Completed', color: '#10B981' },
          { icon: <TrendingUp className="w-4 h-4" />, value: `${totalOpen > 0 ? Math.round((totalDone / totalOpen) * 100) : 100}%`, label: 'Participation', color: '#924700' },
        ].map(({ icon, value, label, color }) => (
          <div key={label} className="rounded-2xl p-4 text-center"
            style={{ background: '#ffffff', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div className="flex justify-center mb-1" style={{ color }}>{icon}</div>
            <p className="text-xl font-bold text-[#191c1d]"
              style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2">
        {(['all', 'elections', 'forms'] as FilterTab[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: filter === f ? '#0058be' : '#f3f4f5',
              color: filter === f ? '#ffffff' : '#727785',
            }}>
            {f === 'all' ? 'All' : f === 'elections' ? 'Elections' : 'Forms'}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#727785] self-center">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Active items list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: '#ffffff', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <AlertCircle className="w-8 h-8 text-[#c2c6d6] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#727785]">No active items.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const club = item.clubId ? clubNames[item.clubId] : null
            const color = urgencyColor(item.closesAt)
            const label = deadlineLabel(item.closesAt)
            const isElection = item.kind === 'election' || item.kind === 'poll'
            const href = `/elections/${item.id}`

            return (
              <Link key={item.id} href={href}>
                <div className="flex gap-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.005]"
                  style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>

                  {/* Date spine */}
                  <div className="w-1.5 shrink-0" style={{ background: color }} />

                  <div className="flex-1 px-4 py-4">
                    <div className="flex items-start gap-3">
                      {/* Club icon or election icon */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 mt-0.5"
                        style={{ background: '#f3f4f5' }}>
                        {club?.iconUrl ?? (isElection ? '🗳️' : '📋')}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Club name + type badge */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold text-[#727785]">
                            {item.subtitle ?? 'School-wide'}
                          </span>
                          {isElection ? (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,88,190,0.1)', color: '#0058be' }}>
                              Election
                            </span>
                          ) : (
                            item.formType && (
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                                style={{ background: FORM_TYPE_COLOR[item.formType], color: FORM_TYPE_TEXT[item.formType] }}>
                                {FORM_TYPE_LABEL[item.formType]}
                              </span>
                            )
                          )}
                          {item.done && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                              ✓ Done
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <p className="font-bold text-[#191c1d] leading-tight mb-1"
                          style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                          {item.title}
                        </p>

                        {/* Description */}
                        {item.description && (
                          <p className="text-xs text-[#727785] leading-relaxed line-clamp-2 mb-2">
                            {item.description}
                          </p>
                        )}

                        {/* Deadline + CTA */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
                            <Clock className="w-3.5 h-3.5" />
                            {label}
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-[#0058be]">
                            {currentUser.role !== 'student'
                              ? 'View Details'
                              : item.done
                              ? 'View'
                              : isElection ? 'Vote Now' : 'Open Form'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Closed records ── */}
      {(closedElections.length > 0 || closedForms.length > 0) && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mb-3">Closed Records</p>
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f5' }}>
                  {['Title', 'Type', 'Closed'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#727785]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closedElections.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f8f9fa' }} className="hover:bg-[#f8f9fa] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#191c1d]">{e.positionTitle}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,88,190,0.08)', color: '#0058be' }}>Election</span>
                    </td>
                    <td className="px-4 py-3 text-[#727785]">
                      {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
                {closedForms.map((f) => {
                  const club = clubNames[f.clubId]
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f8f9fa' }} className="hover:bg-[#f8f9fa] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#191c1d]">
                        {club?.name ? `${club.name} — ` : ''}{f.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: FORM_TYPE_COLOR[f.formType], color: FORM_TYPE_TEXT[f.formType] }}>
                          {FORM_TYPE_LABEL[f.formType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#727785]">
                        {f.closesAt ? new Date(f.closesAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </>}
    </div>
  )
}
