'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import { ClubEvent } from '@/types'
import { Search, Clock, MapPin, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

const CLUB_COLORS: Record<string, { spine: string; spineText: string; badge: string; badgeText: string; panel: string }> = {
  'club-robotics':    { spine: 'bg-blue-50',   spineText: 'text-blue-800',   badge: 'bg-blue-100',   badgeText: 'text-blue-700',   panel: 'bg-blue-50/60' },
  'club-drama':       { spine: 'bg-purple-50',  spineText: 'text-purple-800', badge: 'bg-purple-100', badgeText: 'text-purple-700', panel: 'bg-purple-50/60' },
  'club-chess':       { spine: 'bg-amber-50',   spineText: 'text-amber-800',  badge: 'bg-amber-100',  badgeText: 'text-amber-700',  panel: 'bg-amber-50/60' },
  'club-environment': { spine: 'bg-emerald-50', spineText: 'text-emerald-800',badge: 'bg-emerald-100',badgeText: 'text-emerald-700',panel: 'bg-emerald-50/60' },
}

const PAST_COLORS = { spine: 'bg-gray-100', spineText: 'text-gray-500', badge: 'bg-gray-100', badgeText: 'text-gray-500', panel: 'bg-gray-50' }
const DEFAULT_COLORS = { spine: 'bg-blue-50', spineText: 'text-blue-800', badge: 'bg-blue-100', badgeText: 'text-blue-700', panel: 'bg-blue-50/60' }

export default function EventsPage() {
  const { currentUser } = useMockAuth()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const [events, setEvents] = useState<ClubEvent[]>([])
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
        const { data: clubData } = await supabase.from('clubs').select('id, name, icon_url').eq('school_id', currentUser.schoolId)
        if (cancelled) return
        if (!clubData?.length) return

        const nameMap: Record<string, { name: string; iconUrl?: string }> = {}
        for (const c of clubData) nameMap[c.id] = { name: c.name, iconUrl: c.icon_url ?? undefined }
        setClubNames(nameMap)

        const clubIds = clubData.map((c) => c.id)
        const { data } = await supabase.from('events').select('*').in('club_id', clubIds)
        if (cancelled) return
        if (data) {
          setEvents(data.map((e) => ({
            id: e.id, clubId: e.club_id, title: e.title, description: e.description ?? '',
            date: e.date, location: e.location ?? undefined, isPublic: e.is_public, createdBy: e.created_by,
          })))
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load events')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [currentUser.schoolId])

  const today = new Date().toISOString().split('T')[0]

  const publicEvents = events.filter((e) => e.isPublic)
    .filter((e) => {
      const q = search.toLowerCase()
      const club = clubNames[e.clubId]
      return (
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        club?.name.toLowerCase().includes(q)
      )
    })
    .filter((e) => {
      if (filter === 'upcoming') return e.date >= today
      if (filter === 'past') return e.date < today
      return true
    })
    .sort((a, b) => {
      if (filter === 'past') return b.date.localeCompare(a.date)
      return a.date.localeCompare(b.date)
    })

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <h2
            className="text-[2rem] font-bold tracking-tight text-gray-900 leading-tight"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            Events Feed
          </h2>
          <p className="text-gray-500 mt-2 text-sm max-w-sm">
            Upcoming events from clubs across the school.
          </p>
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-10">
        {(['upcoming', 'past', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors ${
              filter === f
                ? 'bg-[#0058be] text-white'
                : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 mb-10">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load events</p>
            <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
          </div>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-red-700 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* Events list */}
      {isLoading ? (
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-6 items-start">
              <div className="hidden lg:block w-20 py-4 rounded-xl">
                <Skeleton className="h-3 w-10 mx-auto mb-1" />
                <Skeleton className="h-8 w-10 mx-auto" />
              </div>
              <div className="flex-1 bg-white rounded-xl p-7" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-2/3 mb-5" />
                <div className="flex gap-5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : publicEvents.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border">
          <p className="text-gray-400 text-sm">No events found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {publicEvents.map((event) => {
            const club = clubNames[event.clubId]
            const isPast = event.date < today
            const date = new Date(event.date + 'T00:00:00')
            const month = date.toLocaleString('en', { month: 'short' }).toUpperCase()
            const day = date.getDate()
            const colors = isPast ? PAST_COLORS : (CLUB_COLORS[event.clubId] ?? DEFAULT_COLORS)

            return (
              <div key={event.id} className="flex flex-col lg:flex-row gap-6 items-start group">
                {/* Date spine */}
                <div
                  className={`hidden lg:flex flex-col items-center justify-center w-20 py-4 rounded-xl shrink-0 ${colors.spine} ${colors.spineText}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-tight">{month}</span>
                  <span
                    className="text-3xl font-black leading-tight"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    {day}
                  </span>
                </div>

                {/* Card */}
                <div
                  className={`flex-1 bg-white rounded-xl overflow-hidden flex flex-col md:flex-row
                    shadow-[0_8px_24px_rgba(0,0,0,0.04)] group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all
                    ${isPast ? 'opacity-60' : ''}`}
                >
                  <div className="p-7 flex-1">
                    {/* Club badge */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm leading-none ${colors.badge}`}>
                        {club?.iconUrl ?? '📌' as string}
                      </div>
                      {club && (
                        <Link
                          href={`/clubs/${event.clubId}`}
                          className={`text-xs font-bold uppercase tracking-wider hover:underline ${colors.badgeText}`}
                        >
                          {club.name}
                        </Link>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className="text-[1.1rem] font-semibold text-gray-900 mb-2 group-hover:text-[#0058be] transition-colors"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      {event.title}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-500 text-sm leading-relaxed mb-5 max-w-xl line-clamp-2">
                      {event.description}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center flex-wrap gap-5">
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Color panel */}
                  <div className={`hidden md:block w-40 relative ${colors.panel}`}>
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/30" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
