'use client'

// Leaderboard (route: /leaderboard, phone + admin). Live via /api/school/leaderboard.

import { useEffect, useState } from 'react'
import { css, BOTTOM, avBg, initials } from '../css'
import { ScreenHeader, Loader, EmptyState } from '../primitives'

interface Entry { userId: string; name: string; xp: number }

export default function AdminLeaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/school/leaderboard', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setEntries(((data?.byXp ?? []) as Entry[])) })
      .catch(() => { if (!cancelled) setEntries([]) })
    return () => { cancelled = true }
  }, [])

  const podium = (entries ?? []).slice(0, 3)
  const rest = entries ?? []

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Leaderboard" subtitle="Top students by engagement XP this term" />
      {entries === null ? <Loader /> : entries.length === 0 ? (
        <div style={css('padding:20px;')}><EmptyState title="No rankings yet" sub="Engagement XP will populate this board." /></div>
      ) : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:4px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {podium.length >= 2 && (
            <div style={css('display:flex;align-items:flex-end;gap:10px;margin:8px 0 18px;')}>
              {/* 2nd */}
              <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}>
                <span style={css(`width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;font-family:var(--font-manrope);background:${avBg(podium[1].name)};border:3px solid #cbd5e1;`)}>{initials(podium[1].name)}</span>
                <div style={css('font-size:11.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[1].name.split(' ')[0]}</div>
                <div style={css('font-size:11px;color:#9aa0ac;font-weight:600;')}>{podium[1].xp.toLocaleString()} XP</div>
                <div style={css("width:100%;height:54px;background:linear-gradient(180deg,#e2e5ea,#eef0f3);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:18px;color:#94a0b0;")}>2</div>
              </div>
              {/* 1st */}
              <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" style={css('margin-bottom:4px;')}><path d="M5 16 3 5l5.5 4L12 4l3.5 5L21 5l-2 11zM5 19h14v2H5z" /></svg>
                <span style={css(`width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:19px;font-family:var(--font-manrope);background:${avBg(podium[0].name)};border:3px solid #f59e0b;`)}>{initials(podium[0].name)}</span>
                <div style={css('font-size:12.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[0].name.split(' ')[0]}</div>
                <div style={css('font-size:11px;color:#f59e0b;font-weight:700;')}>{podium[0].xp.toLocaleString()} XP</div>
                <div style={css("width:100%;height:74px;background:linear-gradient(180deg,#fde68a,#fef3c7);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:22px;color:#d97706;")}>1</div>
              </div>
              {/* 3rd */}
              <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}>
                {podium[2] ? <>
                  <span style={css(`width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;font-family:var(--font-manrope);background:${avBg(podium[2].name)};border:3px solid #e8a87c;`)}>{initials(podium[2].name)}</span>
                  <div style={css('font-size:11.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[2].name.split(' ')[0]}</div>
                  <div style={css('font-size:11px;color:#9aa0ac;font-weight:600;')}>{podium[2].xp.toLocaleString()} XP</div>
                </> : <div style={css('height:90px;')} />}
                <div style={css("width:100%;height:42px;background:linear-gradient(180deg,#f0d9c9,#f7ede4);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#b87a52;")}>3</div>
              </div>
            </div>
          )}
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {rest.map((l, i) => (
              <div key={l.userId} style={css(`display:flex;align-items:center;gap:12px;padding:11px 0;${i < rest.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <span style={css("width:22px;text-align:center;font-family:var(--font-manrope);font-weight:800;font-size:14px;color:#b3b9c4;")}>#{i + 1}</span>
                <span style={css(`width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12.5px;font-family:var(--font-manrope);flex:none;background:${avBg(l.name)};`)}>{initials(l.name)}</span>
                <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{l.name}</div></div>
                <span style={css('font-size:12.5px;font-weight:800;color:#6366f1;')}>{l.xp.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
