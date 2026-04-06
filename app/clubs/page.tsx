'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS, USERS, MEMBERSHIPS } from '@/lib/mock-data'
import Avatar from '@/components/Avatar'
import { Search, ArrowRight } from 'lucide-react'

// Background patterns cycled per card
const PATTERNS = [
  'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
  'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
  'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
  'linear-gradient(0deg, currentColor 1px, transparent 1px)',
]
const PATTERN_SIZES = ['16px 16px', '10px 10px', '8px 8px', '100% 20px']

// Theme colors per club based on first tag
function clubTheme(tags: string[] = []): { icon: string; iconText: string; dot: string; panelColor: string } {
  const t = tags[0]?.toLowerCase() ?? ''
  if (t === 'stem' || t === 'engineering')
    return { icon: 'bg-blue-50 text-blue-600',   iconText: 'text-blue-600',   dot: 'bg-blue-500',    panelColor: 'text-blue-300' }
  if (t === 'arts' || t === 'performance')
    return { icon: 'bg-purple-50 text-purple-600', iconText: 'text-purple-600', dot: 'bg-purple-500',  panelColor: 'text-purple-300' }
  if (t === 'environment' || t === 'community')
    return { icon: 'bg-emerald-50 text-emerald-600', iconText: 'text-emerald-600', dot: 'bg-emerald-500', panelColor: 'text-emerald-300' }
  if (t === 'strategy' || t === 'games')
    return { icon: 'bg-amber-50 text-amber-600',  iconText: 'text-amber-600',  dot: 'bg-amber-500',   panelColor: 'text-amber-300' }
  return { icon: 'bg-gray-100 text-gray-600', iconText: 'text-gray-600', dot: 'bg-gray-400', panelColor: 'text-gray-300' }
}

function capacityDot(memberCount: number, capacity: number | null): string {
  if (capacity === null) return 'bg-blue-500'
  const ratio = memberCount / capacity
  if (ratio >= 0.9) return 'bg-red-500'
  if (ratio >= 0.6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function ClubsPage() {
  const { currentUser } = useMockAuth()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const myMembershipClubIds = MEMBERSHIPS
    .filter((m) => m.userId === currentUser.id)
    .map((m) => m.clubId)

  // Collect unique tags
  const allTags = Array.from(
    new Set(CLUBS.flatMap((c) => c.tags ?? []))
  )

  const filtered = CLUBS.filter((club) => {
    const q = search.toLowerCase()
    const matchesSearch =
      club.name.toLowerCase().includes(q) ||
      club.description.toLowerCase().includes(q) ||
      club.tags?.some((t) => t.toLowerCase().includes(q))
    const matchesTag = activeTag === null || club.tags?.includes(activeTag)
    return matchesSearch && matchesTag
  })

  return (
    <div className="max-w-7xl mx-auto">
      {/* Editorial Header */}
      <header className="mb-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-8">
          <div>
            <h2
              className="font-extrabold text-[3rem] leading-[1.05] tracking-tight text-gray-900 mb-4"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Explore <br />
              <span className="text-[#0058be]">Communities</span>
            </h2>
            <p className="text-gray-500 max-w-md text-base leading-relaxed">
              Discover academic circles, creative collectives, and initiatives designed to expand your school experience.
            </p>
          </div>
          <div className="flex items-center bg-gray-100 px-3 py-2.5 rounded-xl min-w-[280px] gap-2">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              className="bg-transparent border-none focus:outline-none w-full text-sm text-gray-900 placeholder:text-gray-400 font-medium"
              placeholder="Find your tribe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors ${
              activeTag === null
                ? 'bg-[#0058be] text-white shadow-lg shadow-blue-500/20'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            All Clubs
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors ${
                activeTag === tag
                  ? 'bg-[#0058be] text-white shadow-lg shadow-blue-500/20'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </header>

      {/* Club grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No clubs match your search.</p>
        </div>
      ) : (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
        >
          {filtered.map((club, i) => {
            const advisor = USERS.find((u) => u.id === club.advisorId)
            const isMember = myMembershipClubIds.includes(club.id)
            const isFull = club.capacity !== null && club.memberIds.length >= club.capacity
            const theme = clubTheme(club.tags)
            const dot = capacityDot(club.memberIds.length, club.capacity)
            const pattern = PATTERNS[i % PATTERNS.length]
            const patternSize = PATTERN_SIZES[i % PATTERN_SIZES.length]

            return (
              <Link key={club.id} href={`/clubs/${club.id}`}>
                <div className="group relative bg-white rounded-xl p-7 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col justify-between min-h-[260px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.09)] transition-all cursor-pointer">
                  {/* Background pattern decoration */}
                  <div
                    className="absolute top-0 right-0 w-1/3 h-full opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none"
                    style={{
                      maskImage: 'linear-gradient(to left, black, transparent)',
                      WebkitMaskImage: 'linear-gradient(to left, black, transparent)',
                      backgroundImage: pattern,
                      backgroundSize: patternSize,
                      color: 'currentColor',
                    }}
                  />

                  <div>
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-5 ${theme.icon}`}>
                      {club.iconUrl ?? '📌'}
                    </div>

                    {/* Name + joined badge */}
                    <div className="flex items-start gap-2 mb-2">
                      <h3
                        className="font-bold text-xl text-gray-900 leading-tight flex-1"
                        style={{ fontFamily: 'var(--font-manrope)' }}
                      >
                        {club.name}
                      </h3>
                      {isMember && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0058be] bg-blue-50 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                          Joined
                        </span>
                      )}
                    </div>

                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-5">
                      {club.description}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="space-y-3 pt-5 border-t border-gray-100">
                    {/* Advisor */}
                    {advisor && (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={advisor.name} size="sm" />
                        <span className="text-xs font-semibold text-gray-500 tracking-tight">
                          {advisor.name}
                        </span>
                      </div>
                    )}

                    {/* Member count + arrow */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {club.memberIds.length} / {club.capacity === null ? '∞' : club.capacity} Members
                          {isFull && ' · Full'}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#0058be] group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-20 pt-10 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-gray-400">
        <div className="flex gap-6">
          <span className="text-xs font-bold uppercase tracking-widest">Directory Rules</span>
          <span className="text-xs font-bold uppercase tracking-widest">Safety Guidelines</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {CLUBS.length} Active Communities
          </span>
        </div>
      </footer>
    </div>
  )
}
