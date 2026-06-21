'use client'

import { useEffect, useState } from 'react'
import { computeUserTotalHours, formatHours, MemberHours } from '@/lib/rewards/hours'
import { computeStreak, StreakInfo } from '@/lib/rewards/streaks'
import { getRecordsByClub } from '@/lib/attendance-store'
import { getAdminSettings } from '@/lib/settings-store'
import { Clock, Flame } from 'lucide-react'

interface Props {
  userId: string
  clubIds: string[]
}

export default function RewardsSummary({ userId, clubIds }: Props) {
  const [hours, setHours] = useState<MemberHours>({ autoMinutes: 0, adjustmentMinutes: 0, totalMinutes: 0 })
  const [streak, setStreak] = useState<StreakInfo>({ current: 0, longest: 0 })
  const [loading, setLoading] = useState(true)
  const settings = getAdminSettings()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      computeUserTotalHours(userId),
      Promise.all(clubIds.map((id) => getRecordsByClub(id))).then((r) =>
        r.flat().filter((rec) => rec.userId === userId),
      ),
    ]).then(([h, records]) => {
      if (cancelled) return
      setHours(h)
      setStreak(computeStreak(records))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [userId, clubIds])

  if (!settings.hoursTrackingEnabled && !settings.streaksEnabled) {
    return null
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200/60 p-6 space-y-5"
      style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Rewards
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {settings.hoursTrackingEnabled && (
          <SummaryStat
            icon={<Clock className="w-4 h-4" />}
            color="text-indigo-600"
            bg="bg-indigo-50"
            value={loading ? '…' : formatHours(hours.totalMinutes)}
            label="Total hours"
            sub={hours.adjustmentMinutes !== 0
              ? `${formatHours(hours.autoMinutes)} auto · ${hours.adjustmentMinutes > 0 ? '+' : ''}${formatHours(Math.abs(hours.adjustmentMinutes))} advisor`
              : undefined}
          />
        )}
        {settings.streaksEnabled && (
          <SummaryStat
            icon={<Flame className="w-4 h-4" />}
            color="text-rose-600"
            bg="bg-rose-50"
            value={loading ? '…' : `${streak.current}`}
            label="Current streak"
            sub={streak.longest > streak.current ? `Best: ${streak.longest}` : undefined}
          />
        )}
      </div>
    </div>
  )
}

function SummaryStat({
  icon, color, bg, value, label, sub,
}: {
  icon: React.ReactNode; color: string; bg: string;
  value: string; label: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 p-4">
      <div className={`w-7 h-7 rounded-lg ${bg} ${color} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-slate-900 leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
        {value}
      </p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

