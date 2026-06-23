'use client'

// Current user's own profile (route: /profile, phone + student/advisor).
// Live hours + their clubs & roles.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolClubs } from '@/lib/school-api'
import { computeUserTotalHours, formatHours } from '@/lib/rewards/hours'
import type { Club } from '@/types'
import { css, TOP, BOTTOM, avBg, initials, clubGlyph } from '../css'
import { Loader } from '../primitives'

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  student: { label: 'STUDENT', bg: '#e8faf2', color: '#10b981' },
  advisor: { label: 'FACULTY ADVISOR', bg: '#eef0ff', color: '#6366f1' },
  admin: { label: 'SCHOOL ADMIN', bg: '#ffe4e6', color: '#e11d48' },
  superadmin: { label: 'SUPER ADMIN', bg: '#ffe4e6', color: '#e11d48' },
}

export default function SelfProfile() {
  const { currentUser } = useMockAuth()
  const router = useRouter()
  const [hours, setHours] = useState('—')
  const [clubs, setClubs] = useState<Club[] | null>(null)

  useEffect(() => {
    if (!currentUser.id) return
    let cancelled = false
    Promise.all([
      computeUserTotalHours(currentUser.id),
      apiSchoolClubs(),
    ]).then(([h, c]) => {
      if (cancelled) return
      setHours(formatHours(h.totalMinutes))
      setClubs(c.clubs)
    }).catch(() => { if (!cancelled) setClubs([]) })
    return () => { cancelled = true }
  }, [currentUser.id])

  const myClubs = useMemo(() => (clubs ?? [])
    .filter(c => c.memberIds.includes(currentUser.id) || c.advisorId === currentUser.id)
    .map(c => {
      const pos = c.leadershipPositions.find(p => p.userId === currentUser.id)
      const role = c.advisorId === currentUser.id ? 'Advisor' : pos?.title || 'Member'
      return { id: c.id, name: c.name, icon: clubGlyph(c), role }
    }), [clubs, currentUser.id])

  const badge = ROLE_BADGE[currentUser.role] ?? ROLE_BADGE.student
  const stats: [string, string][] = [[hours, 'Hours'], [String(myClubs.length), myClubs.length === 1 ? 'Club' : 'Clubs']]

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 16px 0;flex:none;display:flex;justify-content:flex-end;'), paddingTop: TOP(14) }}>
        <button onClick={() => router.push('/settings')} style={css('width:38px;height:38px;border-radius:50%;border:1px solid #e7e8ec;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#384152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></button>
      </div>
      <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:8px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
        <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;')}>
          <span style={css(`width:88px;height:88px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:30px;font-family:var(--font-manrope);background:${avBg(currentUser.name || 'Me')};box-shadow:0 10px 24px rgba(99,102,241,.3);`)}>{initials(currentUser.name || 'Me')}</span>
          <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;letter-spacing:-.02em;color:#0f1729;margin-top:13px;")}>{currentUser.name || 'You'}</div>
          <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{currentUser.email}</div>
          <span style={css(`font-size:11px;font-weight:800;letter-spacing:.05em;color:${badge.color};background:${badge.bg};padding:5px 12px;border-radius:9px;margin-top:11px;`)}>{badge.label}</span>
        </div>
        <div style={css('display:flex;gap:11px;margin-top:22px;')}>
          {stats.map(([v, l]) => (
            <div key={l} style={css('flex:1;background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:15px 8px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:22px;color:#0f1729;")}>{v}</div><div style={css('font-size:11px;color:#8a8f9a;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{l}</div></div>
          ))}
        </div>
        <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;margin:22px 4px 11px;")}>Clubs &amp; roles</div>
        {clubs === null ? <Loader /> : (
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {myClubs.length === 0 ? (
              <button onClick={() => router.push('/clubs')} style={css('width:100%;padding:18px 0;text-align:center;font-size:13px;color:#6366f1;font-weight:600;background:none;border:none;cursor:pointer;')}>Browse clubs to join →</button>
            ) : myClubs.map((c, i) => (
              <button key={c.id} onClick={() => router.push(`/clubs/${c.id}`)} style={css(`width:100%;display:flex;align-items:center;gap:11px;padding:12px 0;border:none;background:none;cursor:pointer;text-align:left;${i < myClubs.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <span style={css('font-size:22px;width:30px;text-align:center;flex:none;')}>{c.icon}</span>
                <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{c.name}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{c.role}</div></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
