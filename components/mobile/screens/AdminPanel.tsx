'use client'

// Admin panel (route: /admin, phone + admin). The iOS-friendly hub for setting
// up clubs and managing staff/access. Live via /api/school/clubs.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolClubs } from '@/lib/school-api'
import type { Club } from '@/types'
import { css, TOP, BOTTOM, clubGlyph, tintFor } from '../css'
import { Loader } from '../primitives'

const MANAGE = [
  { label: 'Staff & roles', sub: 'Promote advisors & admins', href: '/admin/staff', bg: '#eef0ff', stroke: '#6366f1', icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></> },
  { label: 'Invite codes', sub: 'Onboard new members', href: '/invites', bg: '#e8faf2', stroke: '#10b981', icon: <path d="M21 2 11 12M21 2l-7 20-4-9-9-4z" /> },
  { label: 'Elections', sub: 'Run school-wide votes', href: '/elections', bg: '#f3edff', stroke: '#8b5cf6', icon: <path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" /> },
  { label: 'Events', sub: 'Schedule across clubs', href: '/events', bg: '#fff1e9', stroke: '#f59e0b', icon: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
]

export default function AdminPanel() {
  const { actualUser } = useMockAuth()
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[] | null>(null)
  const [advisorNames, setAdvisorNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!actualUser.id) return
    let cancelled = false
    apiSchoolClubs().then(r => {
      if (cancelled) return
      setClubs(r.clubs)
      setAdvisorNames(r.advisorNames)
    }).catch(() => { if (!cancelled) setClubs([]) })
    return () => { cancelled = true }
  }, [actualUser.id])

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 20px 10px;background:#f2f2f7;flex:none;'), paddingTop: TOP(20) }}>
        <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Admin panel</div>
        <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>Set up clubs and manage who runs them</div>
      </div>

      <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:8px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
        <button onClick={() => router.push('/admin/new-club')} style={css('width:100%;background:linear-gradient(135deg,#6366f1,#7c83f5 45%,#10b981);border:none;border-radius:20px;padding:20px;display:flex;align-items:center;gap:15px;cursor:pointer;text-align:left;box-shadow:0 14px 30px -10px rgba(99,102,241,.55);')}>
          <span style={css('width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
          <div style={css('flex:1;')}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:19px;color:#fff;letter-spacing:-.02em;")}>Create a club</div><div style={css('font-size:12.5px;color:rgba(255,255,255,.85);font-weight:500;margin-top:2px;')}>Name it, assign an advisor, go live in under a minute</div></div>
        </button>

        <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:22px 4px 11px;')}>Manage</div>
        <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px;')}>
          {MANAGE.map(m => (
            <button key={m.href} onClick={() => router.push(m.href)} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:11px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              <span style={css(`width:40px;height:40px;border-radius:12px;background:${m.bg};display:flex;align-items:center;justify-content:center;`)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={m.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg></span>
              <div><div style={css('font-size:14px;font-weight:700;color:#1f2734;')}>{m.label}</div><div style={css('font-size:11px;color:#9aa0ac;font-weight:500;margin-top:1px;')}>{m.sub}</div></div>
            </button>
          ))}
        </div>

        <div style={css('display:flex;align-items:center;justify-content:space-between;margin:22px 4px 11px;')}>
          <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;')}>Your clubs ({clubs?.length ?? 0})</div>
          <button onClick={() => router.push('/admin/new-club')} style={css('font-size:12px;font-weight:700;color:#6366f1;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;')}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New</button>
        </div>
        {clubs === null ? <Loader /> : clubs.length === 0 ? (
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;")}>No clubs yet</div>
            <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>Create your first club to get started.</div>
          </div>
        ) : (
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {clubs.map((c, i) => (
              <button key={c.id} onClick={() => router.push(`/clubs/${c.id}`)} style={css(`width:100%;display:flex;align-items:center;gap:12px;padding:12px 0;border:none;background:none;cursor:pointer;text-align:left;${i < clubs.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <span style={css(`width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:21px;flex:none;background:${tintFor(c.id)};`)}>{clubGlyph(c)}</span>
                <div style={css('flex:1;min-width:0;')}><div style={css("font-size:14px;font-weight:700;color:#0f1729;font-family:var(--font-manrope);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>{c.name}</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>{advisorNames[c.advisorId] ?? 'No advisor'} · {c.memberIds.length} members</div></div>
                <span style={css('font-size:11.5px;font-weight:700;color:#6366f1;background:#eef0ff;padding:5px 10px;border-radius:9px;flex:none;')}>Manage</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
