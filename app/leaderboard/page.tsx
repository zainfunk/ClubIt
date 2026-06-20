'use client'

import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import AdminLeaderboard from '@/components/mobile/screens/AdminLeaderboard'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchAdminSettings, getAdminSettings } from '@/lib/settings-store'
import { formatHours } from '@/lib/rewards/hours'
import { xpToLevel, levelTitle } from '@/lib/rewards/xp'
import Avatar from '@/components/Avatar'
import { Trophy, Clock, Flame, Sparkles, Lock } from 'lucide-react'

interface Entry {
  userId: string
  name: string
  totalMinutes: number
  xp: number
  longestStreak: number
}

type Tab = 'hours' | 'xp' | 'streak'

export default function LeaderboardPage() {
  const adminPhone = useIsAdminPhone()
  if (adminPhone) return <AdminLeaderboard />
  return <LeaderboardDesktop />
}

function LeaderboardDesktop() {
  const { currentUser } = useMockAuth()
  const [data, setData] = useState<{ byHours: Entry[]; byXp: Entry[]; byStreak: Entry[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(getAdminSettings().leaderboardsEnabled)
  const [tab, setTab] = useState<Tab>('hours')

  useEffect(() => {
    void fetchAdminSettings().then((s) => setEnabled(s.leaderboardsEnabled))
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    fetch('/api/school/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [enabled])

  if (!enabled) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Lock className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-700">Leaderboards are off</h1>
        <p className="text-sm text-slate-500 mt-2">
          Your school admin has disabled school-wide leaderboards.
        </p>
      </div>
    )
  }

  if (loading) {
    return <p className="text-center text-sm text-slate-400 py-12">Loading leaderboard…</p>
  }
  if (!data) notFound()

  const tabs: { key: Tab; label: string; icon: React.ReactNode; colorClass: string }[] = [
    { key: 'hours',  label: 'Hours',  icon: <Clock className="w-3.5 h-3.5" />,  colorClass: 'text-indigo-600' },
    { key: 'xp',     label: 'XP',     icon: <Sparkles className="w-3.5 h-3.5" />, colorClass: 'text-violet-600' },
    { key: 'streak', label: 'Streak', icon: <Flame className="w-3.5 h-3.5" />,  colorClass: 'text-rose-600' },
  ]

  const list =
    tab === 'hours' ? data.byHours :
    tab === 'xp'    ? data.byXp :
                       data.byStreak

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 text-white shadow-lg shadow-indigo-500/20">
        <div className="flex items-center gap-3">
          <Trophy className="w-7 h-7" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
              School Leaderboard
            </h1>
            <p className="text-xs text-indigo-100 mt-0.5">Top 25 by hours, XP, and longest streak</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className={tab === t.key ? t.colorClass : ''}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/60 overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
        {list.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 italic">No data yet.</p>
        ) : (
          <ul>
            {list.map((entry, i) => {
              const rank = i + 1
              const isMe = entry.userId === currentUser.id
              const value =
                tab === 'hours' ? formatHours(entry.totalMinutes) :
                tab === 'xp'    ? `${entry.xp.toLocaleString()} XP` :
                                  `${entry.longestStreak}`
              const sub =
                tab === 'xp' ? `Level ${xpToLevel(entry.xp)} · ${levelTitle(xpToLevel(entry.xp))}` :
                tab === 'streak' ? 'consecutive meetings' :
                                  null
              return (
                <li
                  key={entry.userId}
                  className={`flex items-center gap-4 px-5 py-3 border-t border-slate-100 first:border-t-0 ${
                    isMe ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <span
                    className={`w-8 text-center text-sm font-extrabold tabular-nums ${
                      rank === 1 ? 'text-yellow-500'
                        : rank === 2 ? 'text-slate-400'
                        : rank === 3 ? 'text-amber-700'
                        : 'text-slate-300'
                    }`}
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    {rank}
                  </span>
                  <Avatar name={entry.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/profile/${entry.userId}`}
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors truncate"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      {entry.name}
                      {isMe && <span className="ml-2 text-[10px] text-indigo-500 uppercase tracking-wider">you</span>}
                    </Link>
                    {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums" style={{ fontFamily: 'var(--font-manrope)' }}>
                    {value}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
