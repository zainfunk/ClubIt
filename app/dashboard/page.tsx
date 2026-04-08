'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import { Users, BookOpen, Pin, Calendar, MessageSquare, CheckCircle, Clock } from 'lucide-react'
import type { Club, ClubEvent, ClubNews, JoinRequest } from '@/types'

function getPattern(club: Club): 'chess' | 'art' | 'robotics' {
  const tags = (club.tags ?? []).map((t) => t.toLowerCase())
  if (tags.some((t) => ['stem', 'engineering', 'technology', 'robotics'].includes(t))) return 'robotics'
  if (tags.some((t) => ['arts', 'art', 'performance', 'theatre', 'music', 'creative'].includes(t))) return 'art'
  return 'chess'
}

const PATTERN_ICON_STYLES: Record<string, { bg: string; text: string }> = {
  robotics: { bg: 'rgba(0, 88, 190, 0.08)', text: '#0058be' },
  art:      { bg: 'rgba(16, 185, 129, 0.08)', text: '#059669' },
  chess:    { bg: '#edeeef', text: '#374151' },
}

export default function DashboardPage() {
  const { currentUser } = useMockAuth()
  const [myClubs, setMyClubs] = useState<Club[]>([])
  const [advisorNames, setAdvisorNames] = useState<Record<string, string>>({})
  const [pinnedNews, setPinnedNews] = useState<Record<string, ClubNews>>({})
  const [nextEvents, setNextEvents] = useState<Record<string, ClubEvent>>({})
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([])
  const [issueReports, setIssueReports] = useState<{ id: string; reporter_name: string; reporter_email: string; message: string; status: string; created_at: string }[]>([])

  useEffect(() => {
    if (!currentUser.id || !currentUser.schoolId) return

    const today = new Date().toISOString().split('T')[0]

    if (currentUser.role === 'student') {
      // Load clubs I'm a member of
      supabase.from('memberships').select('club_id').eq('user_id', currentUser.id).then(async ({ data: memberData }) => {
        const myClubIds = (memberData ?? []).map((r) => r.club_id)
        if (myClubIds.length === 0) return

        const { data: clubData } = await supabase.from('clubs').select('*').in('id', myClubIds).eq('school_id', currentUser.schoolId!)
        if (!clubData) return

        const clubs: Club[] = clubData.map((d) => ({
          id: d.id, name: d.name, description: d.description ?? '',
          iconUrl: d.icon_url ?? undefined, advisorId: d.advisor_id ?? '',
          memberIds: myClubIds, leadershipPositions: [], socialLinks: [], meetingTimes: [],
          tags: d.tags ?? [], eventCreatorIds: d.event_creator_ids ?? [],
          capacity: d.capacity ?? null, autoAccept: d.auto_accept ?? false, createdAt: d.created_at ?? '',
        }))
        setMyClubs(clubs)

        // Load advisor names
        const advisorIds = [...new Set(clubs.map((c) => c.advisorId).filter(Boolean))]
        if (advisorIds.length > 0) {
          supabase.from('users').select('id, name').in('id', advisorIds).then(({ data: uData }) => {
            if (uData) {
              const map: Record<string, string> = {}
              for (const u of uData) map[u.id] = u.name
              setAdvisorNames(map)
            }
          })
        }

        // Load pinned news per club
        supabase.from('club_news').select('*').in('club_id', myClubIds).eq('is_pinned', true).then(({ data: newsData }) => {
          if (!newsData) return
          const map: Record<string, ClubNews> = {}
          for (const n of newsData) {
            const existing = map[n.club_id]
            if (!existing || new Date(n.created_at) > new Date(existing.createdAt)) {
              map[n.club_id] = { id: n.id, clubId: n.club_id, title: n.title, content: n.content, authorId: n.author_id, createdAt: n.created_at, isPinned: n.is_pinned }
            }
          }
          setPinnedNews(map)
        })

        // Load next upcoming event per club
        supabase.from('events').select('*').in('club_id', myClubIds).gte('date', today).order('date').then(({ data: evData }) => {
          if (!evData) return
          const map: Record<string, ClubEvent> = {}
          for (const e of evData) {
            if (!map[e.club_id]) {
              map[e.club_id] = { id: e.id, clubId: e.club_id, title: e.title, description: e.description ?? '', date: e.date, location: e.location ?? undefined, isPublic: e.is_public, createdBy: e.created_by }
            }
          }
          setNextEvents(map)
        })
      })

      // Load pending join requests
      supabase.from('join_requests').select('*').eq('user_id', currentUser.id).eq('status', 'pending').then(({ data }) => {
        setPendingRequests((data ?? []).map((r) => ({ id: r.id, clubId: r.club_id, userId: r.user_id, requestedAt: r.requested_at, status: r.status })))
      })
    }

    if (currentUser.role === 'advisor') {
      // Load issue reports for this school
      supabase.from('issue_reports').select('*').eq('school_id', currentUser.schoolId!).order('created_at', { ascending: false }).then(({ data }) => {
        if (data) setIssueReports(data)
      })

      // Load clubs I advise
      supabase.from('clubs').select('*').eq('advisor_id', currentUser.id).eq('school_id', currentUser.schoolId!).then(async ({ data: clubData }) => {
        if (!clubData?.length) return

        const clubIds = clubData.map((d) => d.id)

        // Load member counts
        const { data: memberData } = await supabase.from('memberships').select('club_id, user_id').in('club_id', clubIds)
        const memberMap: Record<string, string[]> = {}
        for (const m of memberData ?? []) {
          if (!memberMap[m.club_id]) memberMap[m.club_id] = []
          memberMap[m.club_id].push(m.user_id)
        }

        const clubs: Club[] = clubData.map((d) => ({
          id: d.id, name: d.name, description: d.description ?? '',
          iconUrl: d.icon_url ?? undefined, advisorId: d.advisor_id ?? '',
          memberIds: memberMap[d.id] ?? [], leadershipPositions: [], socialLinks: [], meetingTimes: [],
          tags: d.tags ?? [], eventCreatorIds: d.event_creator_ids ?? [],
          capacity: d.capacity ?? null, autoAccept: d.auto_accept ?? false, createdAt: d.created_at ?? '',
        }))
        setMyClubs(clubs)

        // Pinned news
        supabase.from('club_news').select('*').in('club_id', clubIds).eq('is_pinned', true).then(({ data: newsData }) => {
          if (!newsData) return
          const map: Record<string, ClubNews> = {}
          for (const n of newsData) {
            const existing = map[n.club_id]
            if (!existing || new Date(n.created_at) > new Date(existing.createdAt)) {
              map[n.club_id] = { id: n.id, clubId: n.club_id, title: n.title, content: n.content, authorId: n.author_id, createdAt: n.created_at, isPinned: n.is_pinned }
            }
          }
          setPinnedNews(map)
        })

        // Next events
        const today2 = new Date().toISOString().split('T')[0]
        supabase.from('events').select('*').in('club_id', clubIds).gte('date', today2).order('date').then(({ data: evData }) => {
          if (!evData) return
          const map: Record<string, ClubEvent> = {}
          for (const e of evData) {
            if (!map[e.club_id]) {
              map[e.club_id] = { id: e.id, clubId: e.club_id, title: e.title, description: e.description ?? '', date: e.date, location: e.location ?? undefined, isPublic: e.is_public, createdBy: e.created_by }
            }
          }
          setNextEvents(map)
        })
      })
    }
  }, [currentUser.id, currentUser.schoolId, currentUser.role])

  async function resolveIssue(id: string) {
    await supabase.from('issue_reports').update({ status: 'resolved' }).eq('id', id)
    setIssueReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r))
  }

  const firstName = currentUser.name.split(' ')[0]

  if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">
          As an admin, your dashboard is the{' '}
          <Link href="/admin" className="text-blue-600 underline">Admin Panel</Link>.
        </p>
      </div>
    )
  }

  const ClubCard = ({ club }: { club: Club }) => {
    const pattern = getPattern(club)
    const iconStyle = PATTERN_ICON_STYLES[pattern]
    const pinnedUpdate = pinnedNews[club.id] ?? null
    const nextEvent = nextEvents[club.id] ?? null
    const advisorName = advisorNames[club.advisorId]

    return (
      <Link href={`/clubs/${club.id}`}>
        <div
          className="relative overflow-hidden bg-white rounded-xl p-6 transition-all duration-300 hover:scale-[1.01] cursor-pointer"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}
        >
          <div className={`absolute right-0 top-0 w-[40%] h-full editorial-pattern-${pattern}`} />
          <div className="relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: iconStyle.bg }}>
                {club.iconUrl ?? '📌'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(146, 71, 0, 0.1)', color: '#924700' }}>
                    {currentUser.role}
                  </span>
                </div>
                <h3 className="font-bold text-[#191c1d] leading-tight text-lg" style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                  {club.name}
                </h3>
                {advisorName && <p className="text-sm font-medium text-[#727785]">Advisor: {advisorName}</p>}
                {currentUser.role === 'advisor' && (
                  <p className="text-xs text-[#727785]">{club.memberIds.length} member{club.memberIds.length !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>

            {(pinnedUpdate || nextEvent) && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                {pinnedUpdate ? (
                  <div className="flex items-start gap-2 min-w-0">
                    <Pin className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#924700' }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#924700' }}>Pinned</p>
                      <p className="text-xs font-semibold text-[#191c1d] truncate leading-snug">{pinnedUpdate.title}</p>
                      <p className="text-[11px] text-[#727785] leading-snug line-clamp-2 mt-0.5">{pinnedUpdate.content}</p>
                    </div>
                  </div>
                ) : <div />}

                {nextEvent ? (
                  <div className="flex items-start gap-2 min-w-0">
                    <Calendar className="w-3 h-3 mt-0.5 shrink-0 text-[#0058be]" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0058be] mb-0.5">Next Event</p>
                      <p className="text-xs font-semibold text-[#191c1d] truncate leading-snug">{nextEvent.title}</p>
                      <p className="text-[11px] text-[#727785] mt-0.5">
                        {new Date(nextEvent.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ) : <div />}
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <section className="mb-10">
        <div className="p-6 rounded-xl" style={{ background: 'rgba(33, 112, 228, 0.08)', border: '1px solid rgba(0, 88, 190, 0.1)' }}>
          <h2 className="text-3xl font-extrabold text-[#191c1d] tracking-tight leading-none mb-2" style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
            Hi, {firstName}!
          </h2>
          {pendingRequests.length > 0 && (
            <p className="font-medium text-[#0058be]">
              You have {pendingRequests.length} pending club request{pendingRequests.length !== 1 ? 's' : ''}.
            </p>
          )}
          {currentUser.role === 'advisor' && myClubs.length > 0 && (
            <p className="font-medium text-[#0058be]">
              You are advising {myClubs.length} club{myClubs.length !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {myClubs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            {currentUser.role === 'advisor'
              ? <><Users className="w-8 h-8 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">You are not assigned as advisor to any clubs yet.</p></>
              : <><BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">You haven't joined any clubs yet.</p></>
            }
          </div>
        ) : (
          myClubs.map((club) => <ClubCard key={club.id} club={club} />)
        )}

        <div className="mt-8 rounded-xl p-8 flex flex-col items-center text-center" style={{ border: '2px dashed rgba(194, 198, 214, 0.4)' }}>
          <p className="text-sm font-medium text-[#727785] mb-4">Want to expand your horizons?</p>
          <Link href="/clubs">
            <button className="font-bold py-3 px-8 rounded-full text-sm uppercase tracking-widest transition-colors hover:bg-gray-200" style={{ background: '#e1e3e4', color: '#191c1d', fontFamily: 'var(--font-manrope, sans-serif)' }}>
              EXPLORE ALL CLUBS
            </button>
          </Link>
        </div>

        {/* Issue reports — visible to advisors */}
        {currentUser.role === 'advisor' && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Issue Reports</h3>
              {issueReports.filter((r) => r.status === 'open').length > 0 && (
                <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  {issueReports.filter((r) => r.status === 'open').length} open
                </span>
              )}
            </div>
            {issueReports.length === 0 ? (
              <p className="text-sm text-gray-400">No issue reports yet.</p>
            ) : (
              <div className="space-y-3">
                {issueReports.map((report) => (
                  <div key={report.id} className={`bg-white rounded-xl border border-gray-100 p-4 ${report.status === 'resolved' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{report.reporter_name}</span>
                          <span className="text-xs text-gray-400">{report.reporter_email}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${report.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {report.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{report.message}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(report.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      {report.status === 'open' && (
                        <button onClick={() => resolveIssue(report.id)}
                          className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
