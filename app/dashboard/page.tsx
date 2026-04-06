'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS, getUserById, getClubsByAdvisor, getNewsByClub, getEventsByClub } from '@/lib/mock-data'
import { supabase } from '@/lib/supabase'
import { Users, BookOpen, Pin, Calendar } from 'lucide-react'
import type { Club, JoinRequest } from '@/types'

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
  const [myClubIds, setMyClubIds] = useState<string[]>([])
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([])

  useEffect(() => {
    if (!currentUser.id) return
    supabase.from('memberships').select('club_id').eq('user_id', currentUser.id).then(({ data }) => {
      setMyClubIds((data ?? []).map((r) => r.club_id))
    })
    supabase.from('join_requests').select('*').eq('user_id', currentUser.id).eq('status', 'pending').then(({ data }) => {
      setPendingRequests((data ?? []).map((r) => ({ id: r.id, clubId: r.club_id, userId: r.user_id, requestedAt: r.requested_at, status: r.status })))
    })
  }, [currentUser.id])

  if (currentUser.role === 'student') {
    const myClubs = CLUBS.filter((c) => myClubIds.includes(c.id))
    const firstName = currentUser.name.split(' ')[0]

    return (
      <div className="max-w-2xl mx-auto">
        {/* Welcome Banner */}
        <section className="mb-10">
          <div className="p-6 rounded-xl" style={{ background: 'rgba(33, 112, 228, 0.08)', border: '1px solid rgba(0, 88, 190, 0.1)' }}>
            <h2 className="text-3xl font-extrabold text-[#191c1d] tracking-tight leading-none mb-2"
              style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
              Hi, {firstName}!
            </h2>
            {pendingRequests.length > 0 && (
              <p className="font-medium text-[#0058be]">
                You have {pendingRequests.length} pending club request{pendingRequests.length !== 1 ? 's' : ''}.
              </p>
            )}
          </div>
        </section>

        {/* Club List */}
        <div className="flex flex-col gap-6">
          {myClubs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">You haven't joined any clubs yet.</p>
            </div>
          ) : (
            myClubs.map((club) => {
              const advisor = getUserById(club.advisorId)
              const pattern = getPattern(club)
              const iconStyle = PATTERN_ICON_STYLES[pattern]

              const allNews = getNewsByClub(club.id)
              const pinnedUpdate = allNews
                .filter((n) => n.isPinned)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null

              const today = new Date().toISOString().split('T')[0]
              const nextEvent = getEventsByClub(club.id)
                .filter((e) => e.date >= today)
                .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

              return (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <div
                    className="relative overflow-hidden bg-white rounded-xl p-6 transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}
                  >
                    {/* Decorative pattern */}
                    <div className={`absolute right-0 top-0 w-[40%] h-full editorial-pattern-${pattern}`} />
                    {/* Card content */}
                    <div className="relative z-10">
                      <div className="flex items-center gap-5">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ background: iconStyle.bg }}
                        >
                          {club.iconUrl ?? '📌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-1">
                            <span
                              className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(146, 71, 0, 0.1)', color: '#924700' }}
                            >
                              {currentUser.role}
                            </span>
                          </div>
                          <h3
                            className="font-bold text-[#191c1d] leading-tight text-lg"
                            style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
                          >
                            {club.name}
                          </h3>
                          {advisor && (
                            <p className="text-sm font-medium text-[#727785]">Advisor: {advisor.name}</p>
                          )}
                        </div>
                      </div>

                      {/* Pinned update + next event */}
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
            })
          )}

          {/* Explore All Clubs CTA */}
          <div
            className="mt-8 rounded-xl p-8 flex flex-col items-center text-center"
            style={{ border: '2px dashed rgba(194, 198, 214, 0.4)' }}
          >
            <p className="text-sm font-medium text-[#727785] mb-4">Want to expand your horizons?</p>
            <Link href="/clubs">
              <button
                className="font-bold py-3 px-8 rounded-full text-sm uppercase tracking-widest transition-colors hover:bg-gray-200"
                style={{ background: '#e1e3e4', color: '#191c1d', fontFamily: 'var(--font-manrope, sans-serif)' }}
              >
                EXPLORE ALL CLUBS
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (currentUser.role === 'advisor') {
    const myClubs = getClubsByAdvisor(currentUser.id)
    const firstName = currentUser.name.split(' ')[0]

    return (
      <div className="max-w-2xl mx-auto">
        {/* Welcome Banner */}
        <section className="mb-10">
          <div className="p-6 rounded-xl" style={{ background: 'rgba(33, 112, 228, 0.08)', border: '1px solid rgba(0, 88, 190, 0.1)' }}>
            <h2 className="text-3xl font-extrabold text-[#191c1d] tracking-tight leading-none mb-2"
              style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
              Hi, {firstName}!
            </h2>
            <p className="font-medium text-[#0058be]">
              You are advising {myClubs.length} club{myClubs.length !== 1 ? 's' : ''}.
            </p>
          </div>
        </section>

        {/* Club List */}
        <div className="flex flex-col gap-6">
          {myClubs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">You are not assigned as advisor to any clubs yet.</p>
            </div>
          ) : (
            myClubs.map((club, idx) => {
              const advisor = getUserById(club.advisorId)
              const pattern = getPattern(club)
              const iconStyle = PATTERN_ICON_STYLES[pattern]

              const allNews = getNewsByClub(club.id)
              const pinnedUpdate = allNews
                .filter((n) => n.isPinned)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null

              const today = new Date().toISOString().split('T')[0]
              const nextEvent = getEventsByClub(club.id)
                .filter((e) => e.date >= today)
                .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

              return (
                <Link key={club.id} href={`/clubs/${club.id}`} data-tour-id={idx === 0 ? 'tour-advisor-club-card' : undefined}>
                  <div
                    className="relative overflow-hidden bg-white rounded-xl p-6 transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}
                  >
                    <div className={`absolute right-0 top-0 w-[40%] h-full editorial-pattern-${pattern}`} />
                    <div className="relative z-10">
                      <div className="flex items-center gap-5">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ background: iconStyle.bg }}
                        >
                          {club.iconUrl ?? '📌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-1">
                            <span
                              className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(146, 71, 0, 0.1)', color: '#924700' }}
                            >
                              advisor
                            </span>
                          </div>
                          <h3
                            className="font-bold text-[#191c1d] leading-tight text-lg"
                            style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
                          >
                            {club.name}
                          </h3>
                          {advisor && (
                            <p className="text-sm font-medium text-[#727785]">Advisor: {advisor.name}</p>
                          )}
                          <p className="text-xs text-[#727785]">
                            {club.memberIds.length} member{club.memberIds.length !== 1 ? 's' : ''}
                          </p>
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
            })
          )}

          {/* Explore All Clubs CTA */}
          <div
            className="mt-8 rounded-xl p-8 flex flex-col items-center text-center"
            style={{ border: '2px dashed rgba(194, 198, 214, 0.4)' }}
          >
            <p className="text-sm font-medium text-[#727785] mb-4">Want to expand your horizons?</p>
            <Link href="/clubs">
              <button
                className="font-bold py-3 px-8 rounded-full text-sm uppercase tracking-widest transition-colors hover:bg-gray-200"
                style={{ background: '#e1e3e4', color: '#191c1d', fontFamily: 'var(--font-manrope, sans-serif)' }}
              >
                EXPLORE ALL CLUBS
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-20">
      <p className="text-gray-500">
        As an admin, your dashboard is the{' '}
        <Link href="/admin" className="text-blue-600 underline">
          Admin Panel
        </Link>.
      </p>
    </div>
  )
}
