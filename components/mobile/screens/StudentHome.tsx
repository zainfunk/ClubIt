'use client'

// Student home (route: /dashboard, phone + student). Live via /api/school/dashboard
// + users.xp_total for the level card.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import { xpToLevel, levelTitle } from '@/lib/rewards/xp'
import type { Club, ClubEvent, JoinRequest } from '@/types'
import { css, TOP, BOTTOM, avBg, initials, clubIcon, tintFor } from '../css'
import { Loader } from '../primitives'
import { monthDay } from '../format'

interface DashData {
  clubs: Club[]
  advisorNames: Record<string, string>
  nextEvents: Record<string, ClubEvent>
  pendingRequests: (JoinRequest & { clubName: string })[]
}

const xpForLevel = (l: number) => 50 * l * l

export default function StudentHome() {
  const { actualUser, currentUser, schoolName } = useMockAuth()
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [xp, setXp] = useState(0)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,'
  }, [])

  useEffect(() => {
    if (!actualUser.schoolId) return
    let cancelled = false
    Promise.all([
      fetch('/api/school/dashboard', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      supabase.from('users').select('xp_total').eq('id', actualUser.id).maybeSingle(),
    ]).then(([dash, xpRes]) => {
      if (cancelled) return
      setData({
        clubs: dash?.clubs ?? [],
        advisorNames: dash?.advisorNames ?? {},
        nextEvents: dash?.nextEvents ?? {},
        pendingRequests: dash?.pendingRequests ?? [],
      })
      setXp((xpRes.data?.xp_total as number | undefined) ?? 0)
    })
    return () => { cancelled = true }
  }, [actualUser.schoolId, actualUser.id])

  const level = xpToLevel(xp)
  const curBase = xpForLevel(level)
  const nextBase = xpForLevel(level + 1)
  const pct = Math.max(0, Math.min(100, Math.round(((xp - curBase) / (nextBase - curBase)) * 100)))

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 20px 12px;background:#f2f2f7;flex:none;'), paddingTop: TOP(20) }}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
          <div style={css('min-width:0;')}>
            <div style={css('font-size:13px;color:#8a8f9a;font-weight:600;')}>{greeting}</div>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:25px;letter-spacing:-.03em;color:#0f1729;line-height:1.1;margin-top:1px;")}>{currentUser.name || 'Student'}</div>
            <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{schoolName || 'Your school'}</div>
          </div>
          <button onClick={() => router.push('/profile')} style={{ ...css("width:40px;height:40px;border-radius:50%;border:none;color:#fff;font-weight:700;font-size:14px;font-family:var(--font-manrope);cursor:pointer;box-shadow:0 4px 10px rgba(99,102,241,.25);flex:none;"), background: avBg(currentUser.name || 'Student') }}>{initials(currentUser.name || 'Student')}</button>
        </div>
      </div>

      {data === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {/* level card */}
          <div style={css('background:#0f1729;border-radius:20px;padding:18px;margin-top:8px;color:#fff;animation:fadeIn .3s ease;box-shadow:0 12px 28px -12px rgba(15,23,41,.5);')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;')}>
              <div style={css('font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9aa3b8;')}>Level {level} · {levelTitle(level)}</div>
              <span style={css('font-size:11px;font-weight:700;color:#34d399;background:rgba(52,211,153,.14);padding:3px 8px;border-radius:8px;')}>{xp.toLocaleString()} XP</span>
            </div>
            <div style={css('height:9px;border-radius:6px;background:rgba(255,255,255,.14);overflow:hidden;')}><div style={css(`height:100%;border-radius:6px;background:linear-gradient(90deg,#818cf8,#34d399);width:${pct}%;`)} /></div>
            <div style={css('font-size:11px;color:#9aa3b8;font-weight:600;margin-top:8px;')}>{nextBase - xp > 0 ? `${(nextBase - xp).toLocaleString()} XP to level ${level + 1}` : 'Max level reached'}</div>
          </div>

          {/* pending requests */}
          {data.pendingRequests.length > 0 && (
            <div style={css('margin-top:18px;')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;margin-bottom:11px;")}>Pending requests</div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {data.pendingRequests.map((r, i) => (
                  <div key={r.id} style={css(`display:flex;align-items:center;gap:11px;padding:12px 15px;${i < data.pendingRequests.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                    <span style={css('width:34px;height:34px;border-radius:10px;background:#fff7e6;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{r.clubName}</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>Awaiting approval</div></div>
                    <span style={css('font-size:11px;font-weight:800;color:#b45309;background:#fef3c7;padding:3px 9px;border-radius:9px;flex:none;')}>Pending</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* your clubs */}
          <div style={css('margin-top:22px;')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;")}>Your clubs</div>
              <button onClick={() => router.push('/clubs')} style={css('font-size:12px;font-weight:600;color:#6366f1;background:none;border:none;cursor:pointer;')}>Explore</button>
            </div>
            {data.clubs.length === 0 ? (
              <button onClick={() => router.push('/clubs')} style={css('width:100%;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);cursor:pointer;')}>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;")}>Join your first club</div>
                <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>Tap to browse clubs at your school</div>
              </button>
            ) : data.clubs.map(c => {
              const ev = data.nextEvents[c.id]
              return (
                <button key={c.id} onClick={() => router.push(`/clubs/${c.id}`)} style={css('width:100%;display:flex;align-items:center;gap:13px;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:13px;margin-bottom:10px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <span style={css(`width:50px;height:50px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:25px;flex:none;background:${tintFor(c.id)};`)}>{clubIcon(c.tags, c.name)}</span>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>{c.name}</div>
                    <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{data.advisorNames[c.advisorId] ? `Advised by ${data.advisorNames[c.advisorId]}` : `${c.memberIds.length} members`}</div>
                    {ev && <div style={css('display:flex;align-items:center;gap:6px;margin-top:7px;')}><span style={css('font-size:10.5px;font-weight:800;color:#6366f1;background:#eef0ff;padding:2px 7px;border-radius:6px;')}>{monthDay(ev.date).month} {monthDay(ev.date).day}</span><span style={css('font-size:11.5px;color:#5b6270;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{ev.title}</span></div>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
