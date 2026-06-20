'use client'

// Club detail (route: /clubs/[id], phone). Role-aware: managers see "Manage",
// students see Join / Leave / Pending. Live via /api/school/clubs/[id]
// (service-role; reliable on the phone shell — see lib/school-api.ts).

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiClubDetail, type ClubDetailPayload } from '@/lib/school-api'
import type { User } from '@/types'
import { css, TOP, avBg, clubIcon, gradientFor } from '../css'
import { BackButton, Avatar, Loader } from '../primitives'
import { dayShort, timeRange } from '../format'
import { useToast } from '../toast'
import CreateEventSheet from './CreateEventSheet'

type Detail = ClubDetailPayload

export default function ClubDetail() {
  const params = useParams<{ id: string }>()
  const clubId = params?.id
  const { actualUser, currentUser } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const [data, setData] = useState<Detail | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showEventSheet, setShowEventSheet] = useState(false)

  useEffect(() => {
    if (!actualUser.id || !clubId) return
    let cancelled = false
    apiClubDetail(clubId)
      .then(d => { if (!cancelled) { setData(d); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [actualUser.id, clubId])

  async function reload() {
    if (clubId) setData(await apiClubDetail(clubId))
  }

  async function membershipAction(action: 'join' | 'leave') {
    if (!clubId || busy) return
    setBusy(true)
    try {
      await fetch(`/api/school/clubs/${clubId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      await reload()
      toast(action === 'join' ? 'Request sent' : 'Left club')
    } catch {
      toast('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function decideRequest(reqId: string, action: 'approve' | 'reject') {
    if (!clubId) return
    setData(prev => prev ? { ...prev, requests: prev.requests.filter(r => r.id !== reqId) } : prev)
    toast(action === 'approve' ? 'Member approved' : 'Request declined')
    try {
      await fetch(`/api/school/clubs/${clubId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, requestId: reqId }) })
      await reload()
    } catch { /* optimistic */ }
  }

  if (!loaded) {
    return (
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;')}>
        <div style={{ paddingTop: TOP(8), paddingLeft: 16 }}><BackButton onClick={() => router.push('/clubs')} /></div>
        <Loader />
      </div>
    )
  }

  if (!data) {
    return (
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;')}>
        <div style={{ paddingTop: TOP(8), paddingLeft: 16 }}><BackButton onClick={() => router.push('/clubs')} /></div>
        <div style={css('flex:1;display:flex;align-items:center;justify-content:center;font-size:14px;color:#9aa0ac;')}>Club not found.</div>
      </div>
    )
  }

  const { club, usersById, memberships, requests } = data
  const isManager = currentUser.role === 'admin' || currentUser.role === 'superadmin' || club.advisorId === currentUser.id
  const isMember = club.memberIds.includes(currentUser.id)
  const pending = requests.some(r => r.userId === currentUser.id && r.status === 'pending')
  const advisor = usersById[club.advisorId]
  const presidentPos = club.leadershipPositions.find(p => /president/i.test(p.title) && p.userId)
  const president = presidentPos?.userId ? usersById[presidentPos.userId] : undefined
  const meeting = club.meetingTimes[0]
  const countLabel = `${club.memberIds.length}/${club.capacity ?? '∞'}`
  const roleByUser: Record<string, string> = {}
  for (const p of club.leadershipPositions) if (p.userId) roleByUser[p.userId] = p.title
  const members: User[] = club.memberIds.map(id => usersById[id]).filter(Boolean) as User[]

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={css(`height:170px;position:relative;flex:none;background:${gradientFor(club.id)};`)}>
        <div style={{ position: 'absolute', top: TOP(8), left: 16 }}><BackButton light onClick={() => router.push('/clubs')} /></div>
        <div style={{ position: 'absolute', top: TOP(8), right: 16 }}>
          {isManager ? (
            (currentUser.role === 'admin' || currentUser.role === 'superadmin') ? (
              <button onClick={() => router.push('/admin')} style={css('height:38px;padding:0 15px;border-radius:19px;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;cursor:pointer;')}>Manage</button>
            ) : (
              <button onClick={() => setShowEventSheet(true)} style={css('height:38px;padding:0 15px;border-radius:19px;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Event</button>
            )
          ) : isMember ? (
            <button disabled={busy} onClick={() => membershipAction('leave')} style={css('height:38px;padding:0 15px;border-radius:19px;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;cursor:pointer;')}>Leave</button>
          ) : pending ? (
            <span style={css('height:38px;padding:0 15px;border-radius:19px;background:rgba(255,255,255,.18);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;')}>Pending</span>
          ) : (
            <button disabled={busy} onClick={() => membershipAction('join')} style={css('height:38px;padding:0 18px;border-radius:19px;border:none;background:#fff;color:#0f1729;font-size:13px;font-weight:800;cursor:pointer;')}>Join</button>
          )}
        </div>
        <div style={css('position:absolute;bottom:-30px;left:20px;width:72px;height:72px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 8px 20px rgba(15,23,42,.18);')}>{clubIcon(club.tags, club.name)}</div>
      </div>
      <div className="m-noscroll" style={css('flex:1;overflow-y:auto;padding:42px 20px 40px;')}>
        <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:10px;')}>
          <div style={css('min-width:0;')}>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;letter-spacing:-.03em;color:#0f1729;")}>{club.name}</div>
            <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:600;margin-top:2px;')}>Advised by {advisor?.name ?? 'TBD'}</div>
          </div>
          <span style={css('font-size:11px;font-weight:800;color:#10b981;background:#e8faf2;padding:5px 10px;border-radius:9px;white-space:nowrap;flex:none;')}>{countLabel}</span>
        </div>
        {club.description && <p style={css('font-size:13.5px;line-height:1.55;color:#5b6270;font-weight:500;margin:13px 0 0;')}>{club.description}</p>}

        {club.tags && club.tags.length > 0 && (
          <div style={css('display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;')}>
            {club.tags.map(t => <span key={t} style={css('font-size:11.5px;font-weight:600;color:#5b6270;background:#fff;border:1px solid #eef0f3;padding:5px 11px;border-radius:9px;')}>{t}</span>)}
          </div>
        )}

        {(meeting || president) && (
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:5px 16px;margin-top:18px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {meeting && (
              <div style={css(`display:flex;align-items:center;gap:11px;padding:13px 0;${president ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                <div style={css('flex:1;')}><div style={css('font-size:13px;font-weight:700;color:#1f2734;')}>{dayShort(meeting.dayOfWeek)}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>{timeRange(meeting.startTime, meeting.endTime)}{meeting.location ? ` · ${meeting.location}` : ''}</div></div>
              </div>
            )}
            {president && (
              <div style={css('display:flex;align-items:center;gap:11px;padding:13px 0;')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5z" /></svg>
                <div style={css('flex:1;')}><div style={css('font-size:13px;font-weight:700;color:#1f2734;')}>{president.name}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>President</div></div>
              </div>
            )}
          </div>
        )}

        {isManager && requests.some(r => r.status === 'pending') && (
          <>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin:20px 4px 11px;')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>Requests</div>
              <span style={css('font-size:11px;font-weight:800;color:#b45309;background:#fef3c7;padding:3px 9px;border-radius:9px;')}>{requests.filter(r => r.status === 'pending').length}</span>
            </div>
            <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              {requests.filter(r => r.status === 'pending').map((r, i, arr) => {
                const u = usersById[r.userId]
                return (
                  <div key={r.id} style={css(`display:flex;align-items:center;gap:11px;padding:11px 0;${i < arr.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                    <Avatar name={u?.name ?? '?'} size={36} bg={avBg(u?.name ?? r.userId)} />
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{u?.name ?? 'Student'}</div><div style={css('font-size:11px;color:#9aa0ac;')}>Wants to join</div></div>
                    <button onClick={() => decideRequest(r.id, 'reject')} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #eceef1;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                    <button onClick={() => decideRequest(r.id, 'approve')} style={css('width:32px;height:32px;border-radius:10px;border:none;background:#10b981;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div style={css('display:flex;align-items:center;justify-content:space-between;margin:20px 4px 11px;')}>
          <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>Members</div>
          <span style={css('font-size:12px;font-weight:600;color:#9aa0ac;')}>{countLabel}</span>
        </div>
        <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
          {members.length === 0 ? (
            <div style={css('padding:18px 0;font-size:13px;color:#9aa0ac;text-align:center;')}>No members yet.</div>
          ) : members.map((m, i) => (
            <div key={m.id} style={css(`display:flex;align-items:center;gap:11px;padding:11px 0;${i < members.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
              <Avatar name={m.name} size={36} bg={avBg(m.name)} />
              <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{m.name}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{roleByUser[m.id] || (m.id === club.advisorId ? 'Advisor' : 'Member')}</div></div>
            </div>
          ))}
          {/* members not in leadership but advisor handled above */}
          <MembershipNote count={memberships.length} shown={members.length} />
        </div>
      </div>
      {showEventSheet && clubId && <CreateEventSheet clubId={clubId} onClose={() => setShowEventSheet(false)} onCreated={reload} />}
    </div>
  )
}

function MembershipNote({ count, shown }: { count: number; shown: number }) {
  if (count <= shown) return null
  return <div style={css('padding:11px 0;font-size:11.5px;color:#b3b9c4;text-align:center;')}>{count - shown} more not shown</div>
}
