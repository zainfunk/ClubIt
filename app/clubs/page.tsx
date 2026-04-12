'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { Club } from '@/types'
import Avatar from '@/components/Avatar'
import { Search, ArrowRight, Plus, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import { cachedFetch, invalidateCachePrefix } from '@/lib/fetch-cache'

const PATTERNS = [
  'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
  'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
  'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
  'linear-gradient(0deg, currentColor 1px, transparent 1px)',
]
const PATTERN_SIZES = ['16px 16px', '10px 10px', '8px 8px', '100% 20px']

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
  const { actualUser } = useMockAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [myMembershipClubIds, setMyMembershipClubIds] = useState<string[]>([])
  const [advisorNames, setAdvisorNames] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newCapacity, setNewCapacity] = useState(20)
  const [newUnlimited, setNewUnlimited] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const canCreateClub = actualUser.role === 'advisor' || actualUser.role === 'admin'

  function applyClubsPayload(payload: {
    clubs?: Club[]
    advisorNames?: Record<string, string>
    myMembershipClubIds?: string[]
  }) {
    setClubs(payload.clubs ?? [])
    setAdvisorNames(payload.advisorNames ?? {})
    setMyMembershipClubIds(payload.myMembershipClubIds ?? [])
  }

  async function fetchClubsPayload(bust = false) {
    return cachedFetch<{
      clubs?: Club[]
      advisorNames?: Record<string, string>
      myMembershipClubIds?: string[]
    }>('/api/school/clubs', { ttl: 30_000, bust })
  }

  async function handleCreateClub(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newDesc.trim() || !actualUser.schoolId) return
    setCreating(true)
    setCreateError(null)

    try {
      const res = await fetch('/api/school/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          iconUrl: newIcon.trim() || undefined,
          capacity: newUnlimited ? null : newCapacity,
          advisorId: actualUser.id,
          tags: newTags ? newTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error ?? 'Failed to create club')
      }

      invalidateCachePrefix('/api/school/clubs')
      applyClubsPayload(await fetchClubsPayload(true))
      setNewName('')
      setNewDesc('')
      setNewIcon('')
      setNewTags('')
      setNewCapacity(20)
      setNewUnlimited(false)
      setShowCreateForm(false)
      toast.success('Club created!')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create club')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    // Guard on id (not schoolId) — the server resolves school context itself.
    // Guarding on schoolId causes clubs to never load when the client-side
    // Supabase queries in syncSchoolContext are slow or blocked by RLS.
    if (!actualUser.id) return

    let cancelled = false

    async function loadClubs() {
      try {
        const payload = await fetchClubsPayload()
        if (cancelled) return
        applyClubsPayload(payload)
      } catch (err) {
        if (cancelled) return
        console.error('clubs load error', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadClubs()

    return () => {
      cancelled = true
    }
  }, [actualUser.id])

  const allTags = Array.from(new Set(clubs.flatMap((c) => c.tags ?? [])))

  const filtered = clubs.filter((club) => {
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
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 px-3 py-2.5 rounded-xl min-w-[280px] gap-2">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                className="bg-transparent border-none focus:outline-none w-full text-sm text-gray-900 placeholder:text-gray-400 font-medium"
                placeholder="Find your tribe..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {canCreateClub && (
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0058be] hover:bg-[#0047a0] transition-colors shrink-0"
              >
                {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showCreateForm ? 'Cancel' : 'New Club'}
              </button>
            )}
          </div>
        </div>

        {/* Create club form */}
        {showCreateForm && (
          <form onSubmit={handleCreateClub} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'var(--font-manrope)' }}>Create New Club</h3>
            {createError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-700 block mb-1">Club Name *</label>
                <input required value={newName} onChange={(e) => setNewName(e.target.value)} disabled={creating}
                  placeholder="e.g. Photography Club"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Icon (emoji)</label>
                <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} disabled={creating}
                  placeholder="e.g. 📷"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Description *</label>
              <textarea required value={newDesc} onChange={(e) => setNewDesc(e.target.value)} disabled={creating}
                placeholder="Describe what this club is about..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Tags <span className="text-gray-400">(comma separated)</span></label>
                <input value={newTags} onChange={(e) => setNewTags(e.target.value)} disabled={creating}
                  placeholder="e.g. STEM, Art, Competition"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Member Limit</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
                    <input type="checkbox" checked={newUnlimited} onChange={(e) => setNewUnlimited(e.target.checked)} disabled={creating} />
                    Unlimited
                  </label>
                  {!newUnlimited && (
                    <input type="number" min={1} max={500} value={newCapacity}
                      onChange={(e) => setNewCapacity(Number(e.target.value))} disabled={creating}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  )}
                </div>
              </div>
            </div>
            <button type="submit" disabled={creating}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0058be] hover:bg-[#0047a0] disabled:opacity-50 transition-colors">
              {creating ? 'Creating…' : 'Create Club'}
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors ${
              activeTag === null ? 'bg-[#0058be] text-white shadow-lg shadow-blue-500/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            All Clubs
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors ${
                activeTag === tag ? 'bg-[#0058be] text-white shadow-lg shadow-blue-500/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </header>

      {isLoading && clubs.length === 0 ? (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl p-7 border border-gray-100 min-h-[260px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
              <Skeleton className="w-14 h-14 rounded-full mb-5" />
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-2/3 mb-5" />
              <div className="pt-5 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">{clubs.length === 0 ? 'No clubs have been created yet.' : 'No clubs match your search.'}</p>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filtered.map((club, i) => {
            const advisorName = advisorNames[club.advisorId]
            const isMember = myMembershipClubIds.includes(club.id)
            const isFull = club.capacity !== null && club.memberIds.length >= club.capacity
            const theme = clubTheme(club.tags)
            const dot = capacityDot(club.memberIds.length, club.capacity)
            const pattern = PATTERNS[i % PATTERNS.length]
            const patternSize = PATTERN_SIZES[i % PATTERN_SIZES.length]

            return (
              <Link key={club.id} href={`/clubs/${club.id}`}>
                <div className="group relative bg-white rounded-xl p-7 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col justify-between min-h-[260px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.09)] transition-all cursor-pointer">
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
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-5 ${theme.icon}`}>
                      {club.iconUrl ?? '📌'}
                    </div>
                    <div className="flex items-start gap-2 mb-2">
                      <h3 className="font-bold text-xl text-gray-900 leading-tight flex-1" style={{ fontFamily: 'var(--font-manrope)' }}>
                        {club.name}
                      </h3>
                      {isMember && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0058be] bg-blue-50 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                          Joined
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-5">{club.description}</p>
                  </div>
                  <div className="space-y-3 pt-5 border-t border-gray-100">
                    {advisorName && (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={advisorName} size="sm" />
                        <span className="text-xs font-semibold text-gray-500 tracking-tight">{advisorName}</span>
                      </div>
                    )}
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

      <footer className="mt-20 pt-10 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-gray-400">
        <div className="flex gap-6">
          <span className="text-xs font-bold uppercase tracking-widest">Directory Rules</span>
          <span className="text-xs font-bold uppercase tracking-widest">Safety Guidelines</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{clubs.length} Active Communities</span>
        </div>
      </footer>
    </div>
  )
}
