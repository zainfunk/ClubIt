'use client'

// Advisor home (route: /dashboard, phone + advisor). Their clubs + pending join
// requests to approve, live via /api/school/dashboard (service-role; reliable
// on the phone shell — see lib/school-api.ts).

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiDashboard } from '@/lib/school-api'
import type { Club } from '@/types'
import { css, TOP, BOTTOM, avBg, initials, clubGlyph, tintFor } from '../css'
import { Loader } from '../primitives'
import { useToast } from '../toast'

interface Approval { id: string; clubId: string; clubName: string; userId: string; userName: string }

export default function AdvisorHome() {
  const { actualUser, currentUser, schoolName } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const [clubs, setClubs] = useState<Club[] | null>(null)
  const [requests, setRequests] = useState<Approval[]>([])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,'
  }, [])

  useEffect(() => {
    if (!actualUser.id) return
    let cancelled = false
    apiDashboard().then(dash => {
      if (cancelled) return
      setClubs(dash?.clubs ?? [])
      setRequests((dash?.pendingApprovals ?? []) as Approval[])
    }).catch(() => { if (!cancelled) setClubs([]) })
    return () => { cancelled = true }
  }, [actualUser.id])

  async function decide(req: Approval, action: 'approve' | 'reject') {
    setRequests(prev => prev.filter(r => r.id !== req.id))
    toast(action === 'approve' ? 'Member approved' : 'Request declined')
    try {
      await fetch(`/api/school/clubs/${req.clubId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, requestId: req.id }) })
    } catch { /* optimistic */ }
  }

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 20px 12px;background:#f2f2f7;flex:none;'), paddingTop: TOP(20) }}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
          <div style={css('min-width:0;')}>
            <div style={css('font-size:13px;color:#8a8f9a;font-weight:600;')}>{greeting}</div>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:25px;letter-spacing:-.03em;color:#0f1729;line-height:1.1;margin-top:1px;")}>{currentUser.name || 'Advisor'}</div>
            <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{schoolName || 'Your school'}</div>
          </div>
          <div style={css('display:flex;align-items:center;gap:10px;flex:none;')}>
            <button onClick={() => router.push('/clubs/new')} aria-label="Create club" style={css('width:40px;height:40px;border-radius:14px;border:none;background:#0f1729;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 10px rgba(15,23,41,.22);')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button onClick={() => router.push('/profile')} style={{ ...css("width:40px;height:40px;border-radius:50%;border:none;color:#fff;font-weight:700;font-size:14px;font-family:var(--font-manrope);cursor:pointer;box-shadow:0 4px 10px rgba(99,102,241,.25);"), background: avBg(currentUser.name || 'Advisor') }}>{initials(currentUser.name || 'Advisor')}</button>
          </div>
        </div>
      </div>

      {clubs === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {/* pending approvals */}
          {requests.length > 0 && (
            <div style={css('margin-top:14px;')}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;')}>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;")}>Pending approvals</div>
                <span style={css('font-size:11px;font-weight:800;color:#b45309;background:#fef3c7;padding:3px 9px;border-radius:9px;')}>{requests.length}</span>
              </div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {requests.map((r, i) => {
                  return (
                    <div key={r.id} style={css(`display:flex;align-items:center;gap:11px;padding:12px 15px;${i < requests.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                      <span style={css(`width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:var(--font-manrope);flex:none;background:${avBg(r.userName ?? r.userId)};`)}>{initials(r.userName ?? '?')}</span>
                      <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{r.userName ?? 'Student'}</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>wants to join {r.clubName}</div></div>
                      <button onClick={() => decide(r, 'reject')} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #eceef1;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                      <button onClick={() => decide(r, 'approve')} style={css('width:32px;height:32px;border-radius:10px;border:none;background:#10b981;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* your clubs */}
          <div style={css('margin-top:22px;')}>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;margin-bottom:11px;")}>Your clubs</div>
            {clubs.length === 0 ? (
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;")}>You aren’t advising any clubs yet</div>
                <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>Start one to begin accepting members.</div>
                <button onClick={() => router.push('/clubs/new')} style={css('margin-top:14px;display:inline-flex;align-items:center;gap:6px;background:#0f1729;color:#fff;border:none;border-radius:12px;padding:10px 16px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 4px 10px rgba(15,23,41,.22);')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Create your first club
                </button>
              </div>
            ) : clubs.map(c => {
              const pendingForClub = requests.filter(r => r.clubId === c.id).length
              return (
                <button key={c.id} onClick={() => router.push(`/clubs/${c.id}`)} style={css('width:100%;display:flex;align-items:center;gap:13px;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:13px;margin-bottom:10px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <span style={css(`width:50px;height:50px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:25px;flex:none;background:${tintFor(c.id)};`)}>{clubGlyph(c)}</span>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>{c.name}</div>
                    <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{c.memberIds.length} member{c.memberIds.length === 1 ? '' : 's'}{c.capacity ? ` · ${c.memberIds.length}/${c.capacity}` : ''}</div>
                  </div>
                  {pendingForClub > 0 && <span style={css('font-size:11px;font-weight:800;color:#b45309;background:#fef3c7;padding:3px 9px;border-radius:9px;flex:none;')}>{pendingForClub}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
