'use client'

// Leaderboard (route: /leaderboard, phone — all roles). Live via
// /api/school/leaderboard, which returns byXp / byHours / byStreak rankings.

import { useEffect, useMemo, useState } from 'react'
import { css, BOTTOM, avBg, initials } from '../css'
import { ScreenHeader, Loader, EmptyState } from '../primitives'
import { formatHours } from '@/lib/rewards/hours'

interface Entry { userId: string; name: string; xp: number; totalMinutes: number; longestStreak: number }
type Tab = 'xp' | 'hours' | 'streak'

const TABS: { key: Tab; label: string }[] = [
  { key: 'hours', label: 'Hours' },
  { key: 'xp', label: 'XP' },
  { key: 'streak', label: 'Streak' },
]

export default function AdminLeaderboard() {
  const [boards, setBoards] = useState<{ byXp: Entry[]; byHours: Entry[]; byStreak: Entry[] } | null>(null)
  const [tab, setTab] = useState<Tab>('xp')

  useEffect(() => {
    let cancelled = false
    fetch('/api/school/leaderboard', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        setBoards({ byXp: data?.byXp ?? [], byHours: data?.byHours ?? [], byStreak: data?.byStreak ?? [] })
      })
      .catch(() => { if (!cancelled) setBoards({ byXp: [], byHours: [], byStreak: [] }) })
    return () => { cancelled = true }
  }, [])

  const entries = useMemo<Entry[]>(() => {
    if (!boards) return []
    return tab === 'xp' ? boards.byXp : tab === 'hours' ? boards.byHours : boards.byStreak
  }, [boards, tab])

  function metricLabel(e: Entry): string {
    if (tab === 'xp') return `${e.xp.toLocaleString()} XP`
    if (tab === 'hours') return formatHours(e.totalMinutes)
    return `${e.longestStreak}d`
  }

  const podium = entries.slice(0, 3)
  const accent = tab === 'xp' ? '#6366f1' : tab === 'hours' ? '#10b981' : '#f97316'

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Leaderboard" subtitle="Top students at your school this term">
        <div style={css('display:flex;gap:6px;background:#e6e6ec;border-radius:12px;padding:4px;margin-top:13px;')}>
          {TABS.map(t => {
            const on = tab === t.key
            return <button key={t.key} onClick={() => setTab(t.key)} style={css(`flex:1;height:33px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:700;background:${on ? '#fff' : 'transparent'};color:${on ? '#0f1729' : '#8a8f9a'};box-shadow:${on ? '0 1px 3px rgba(15,23,41,.12)' : 'none'};`)}>{t.label}</button>
          })}
        </div>
      </ScreenHeader>
      {boards === null ? <Loader /> : entries.length === 0 ? (
        <div style={css('padding:20px;')}><EmptyState title="No rankings yet" sub="This board will fill in as students stay active." /></div>
      ) : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:4px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {podium.length >= 2 && (
            <div style={css('display:flex;align-items:flex-end;gap:10px;margin:8px 0 18px;')}>
              {/* 2nd */}
              <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}>
                <span style={css(`width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;font-family:var(--font-manrope);background:${avBg(podium[1].name)};border:3px solid #cbd5e1;`)}>{initials(podium[1].name)}</span>
                <div style={css('font-size:11.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[1].name.split(' ')[0]}</div>
                <div style={css('font-size:11px;color:#9aa0ac;font-weight:600;')}>{metricLabel(podium[1])}</div>
                <div style={css("width:100%;height:54px;background:linear-gradient(180deg,#e2e5ea,#eef0f3);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:18px;color:#94a0b0;")}>2</div>
              </div>
              {/* 1st */}
              <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" style={css('margin-bottom:4px;')}><path d="M5 16 3 5l5.5 4L12 4l3.5 5L21 5l-2 11zM5 19h14v2H5z" /></svg>
                <span style={css(`width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:19px;font-family:var(--font-manrope);background:${avBg(podium[0].name)};border:3px solid #f59e0b;`)}>{initials(podium[0].name)}</span>
                <div style={css('font-size:12.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[0].name.split(' ')[0]}</div>
                <div style={css(`font-size:11px;color:${accent};font-weight:700;`)}>{metricLabel(podium[0])}</div>
                <div style={css("width:100%;height:74px;background:linear-gradient(180deg,#fde68a,#fef3c7);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:22px;color:#d97706;")}>1</div>
              </div>
              {/* 3rd */}
              <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}>
                {podium[2] ? <>
                  <span style={css(`width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;font-family:var(--font-manrope);background:${avBg(podium[2].name)};border:3px solid #e8a87c;`)}>{initials(podium[2].name)}</span>
                  <div style={css('font-size:11.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[2].name.split(' ')[0]}</div>
                  <div style={css('font-size:11px;color:#9aa0ac;font-weight:600;')}>{metricLabel(podium[2])}</div>
                </> : <div style={css('height:90px;')} />}
                <div style={css("width:100%;height:42px;background:linear-gradient(180deg,#f0d9c9,#f7ede4);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#b87a52;")}>3</div>
              </div>
            </div>
          )}
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {entries.map((l, i) => (
              <div key={l.userId} style={css(`display:flex;align-items:center;gap:12px;padding:11px 0;${i < entries.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <span style={css("width:22px;text-align:center;font-family:var(--font-manrope);font-weight:800;font-size:14px;color:#b3b9c4;")}>#{i + 1}</span>
                <span style={css(`width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12.5px;font-family:var(--font-manrope);flex:none;background:${avBg(l.name)};`)}>{initials(l.name)}</span>
                <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{l.name}</div></div>
                <span style={css(`font-size:12.5px;font-weight:800;color:${accent};`)}>{metricLabel(l)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
