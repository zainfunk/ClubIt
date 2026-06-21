'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { BADGES, BadgeDef, TIER_STYLES, BadgeTier } from '@/lib/rewards/badges'
import {
  Award, BookOpen, Check, Clock, Clock4, Clock9, Crown, Flame, Hourglass,
  Layers, Megaphone, Rocket, ShieldCheck, Sparkles, Star, Trophy, Users, Zap,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Award, BookOpen, Check, Clock, Clock4, Clock9, Crown, Flame, Hourglass,
  Layers, Megaphone, Rocket, ShieldCheck, Sparkles, Star, Trophy, Users, Zap,
}

interface Props {
  userId: string
}

export default function BadgeGrid({ userId }: Props) {
  const [earnedKeys, setEarnedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('user_badges')
      .select('badge_key')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (cancelled) return
        setEarnedKeys(new Set((data ?? []).map((r) => r.badge_key as string)))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  const earnedCount = earnedKeys.size

  const grouped = useMemo(() => {
    const tiers: BadgeTier[] = ['platinum', 'gold', 'silver', 'bronze']
    return tiers.map((tier) => ({
      tier,
      badges: BADGES.filter((b) => b.tier === tier),
    }))
  }, [])

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl bg-white border border-slate-200/60 p-6 flex items-center gap-5"
        style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
          <Award className="w-7 h-7 text-white" />
        </div>
        <div>
          <p
            className="text-3xl font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {earnedCount}{' '}
            <span className="text-lg text-slate-400 font-medium">
              / {BADGES.length}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading badges…' : 'Badges earned'}
          </p>
        </div>
      </div>

      {grouped.map(({ tier, badges }) => (
        <div key={tier} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${TIER_STYLES[tier].bg} ${TIER_STYLES[tier].text} ${TIER_STYLES[tier].ring}`}
            >
              {TIER_STYLES[tier].label}
            </span>
            <span className="text-xs text-slate-400">
              {badges.filter((b) => earnedKeys.has(b.key)).length} / {badges.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {badges.map((b) => (
              <BadgeTile key={b.key} badge={b} earned={earnedKeys.has(b.key)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BadgeTile({ badge, earned }: { badge: BadgeDef; earned: boolean }) {
  const Icon = ICONS[badge.icon] ?? Award
  return (
    <div
      className={`rounded-2xl p-5 flex items-start gap-4 transition-all border ${
        earned
          ? 'bg-white border-slate-200/60'
          : 'bg-slate-50 border-slate-100 opacity-50'
      }`}
      style={earned ? { boxShadow: '0 4px 24px rgba(15,23,42,0.04)' } : {}}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          earned ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-bold text-slate-900 leading-tight"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          {badge.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 leading-tight">{badge.desc}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {earned ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              <Check className="w-3 h-3" /> Earned
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
