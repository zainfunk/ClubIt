'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import Avatar from '@/components/Avatar'

type Filter = 'all' | 'clubs' | 'users'

interface ClubResult { id: string; name: string; iconUrl: string | null }
interface UserResult { id: string; name: string; role: string; avatarUrl: string | null }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', advisor: 'Advisor', student: 'Student', superadmin: 'Superadmin',
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'clubs', label: 'Clubs' },
  { key: 'users', label: 'People' },
]

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [clubs, setClubs] = useState<ClubResult[]>([])
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setClubs([]); setUsers([]); setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/school/search?q=${encodeURIComponent(q)}&type=${filter}`, { cache: 'no-store' })
        if (!res.ok) { setClubs([]); setUsers([]); return }
        const data = await res.json()
        setClubs(data.clubs ?? [])
        setUsers(data.users ?? [])
      } catch {
        setClubs([]); setUsers([])
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [query, filter])

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = useCallback((href: string) => {
    setOpen(false)
    setQuery('')
    setClubs([]); setUsers([])
    router.push(href)
  }, [router])

  const hasQuery = query.trim().length > 0
  const showResults = open && hasQuery
  const empty = !loading && hasQuery && clubs.length === 0 && users.length === 0

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur() } }}
        className="pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 w-44 md:w-64 transition-all outline-none placeholder:text-slate-400"
        placeholder="Search clubs or people..."
        type="text"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setClubs([]); setUsers([]) }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {showResults && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl bg-white border border-slate-200/70 shadow-xl shadow-slate-900/10 z-50 py-2">
          {/* Filter pills */}
          <div className="flex items-center gap-1 px-2.5 pb-2 mb-1 border-b border-slate-100">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
            {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin ml-auto mr-1" />}
          </div>

          {empty && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No matches for &ldquo;{query.trim()}&rdquo;</p>
          )}

          {clubs.length > 0 && (
            <div className="px-1.5">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Clubs</p>
              {clubs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/clubs/${c.id}`)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0">{c.iconUrl ?? '📌'}</span>
                  <span className="text-sm font-medium text-slate-800 truncate">{c.name}</span>
                </button>
              ))}
            </div>
          )}

          {users.length > 0 && (
            <div className="px-1.5 mt-1">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">People</p>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => go(`/profile/${u.id}`)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <Avatar name={u.name} imageUrl={u.avatarUrl} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{u.name}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 shrink-0">{ROLE_LABEL[u.role] ?? u.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
