'use client'

// Club detail (route: /clubs/[id], phone). Role-aware: managers see "Manage",
// students see Join / Leave / Pending. Live via /api/school/clubs/[id]
// (service-role; reliable on the phone shell — see lib/school-api.ts).

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiClubDetail, clubAction, type ClubDetailPayload } from '@/lib/school-api'
import type { ClubEvent, Poll, User } from '@/types'
import { css, TOP, avBg, clubGlyph, gradientFor } from '../css'
import { BackButton, Avatar, Loader } from '../primitives'
import { dayShort, timeRange, monthDay, relTime } from '../format'
import { useToast } from '../toast'
import CreateEventSheet from './CreateEventSheet'
import CreateNewsSheet from './CreateNewsSheet'
import CreatePollSheet from './CreatePollSheet'
import ScanCheckInButton from '@/components/ScanCheckInButton'

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
  const [editEvent, setEditEvent] = useState<ClubEvent | null>(null)
  const [showNewsSheet, setShowNewsSheet] = useState(false)
  const [showPollSheet, setShowPollSheet] = useState(false)
  const [editPoll, setEditPoll] = useState<Poll | null>(null)

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

  // Content + poll actions reuse the shared PATCH actions via clubAction().
  async function contentAction(body: Record<string, unknown>, okMsg?: string) {
    if (!clubId || busy) return
    setBusy(true)
    try {
      await clubAction(clubId, body)
      await reload()
      if (okMsg) toast(okMsg)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function vote(pollId: string, candidateUserId: string) {
    // Optimistic: mark my vote immediately.
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        polls: prev.polls.map(p => p.id === pollId
          ? { ...p, myVoteCandidateId: candidateUserId, candidates: p.candidates.map(c => c.userId === candidateUserId ? { ...c, voteCount: c.voteCount + 1 } : c) }
          : p),
      }
    })
    toast('Vote cast')
    try { await clubAction(clubId!, { action: 'cast_poll_vote', pollId, candidateUserId }); await reload() } catch { /* optimistic */ }
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

  const { club, usersById, memberships, requests, news, events, polls, duesPayments } = data
  const isManager = currentUser.role === 'admin' || currentUser.role === 'superadmin' || club.advisorId === currentUser.id
  const isMember = club.memberIds.includes(currentUser.id)
  const canCreateContent = isManager || club.eventCreatorIds.includes(currentUser.id)
  const pending = requests.some(r => r.userId === currentUser.id && r.status === 'pending')
  const advisor = usersById[club.advisorId]
  const presidentPos = club.leadershipPositions.find(p => /president/i.test(p.title) && p.userId)
  const president = presidentPos?.userId ? usersById[presidentPos.userId] : undefined
  const meeting = club.meetingTimes[0]
  const countLabel = `${club.memberIds.length}/${club.capacity ?? '∞'}`
  const roleByUser: Record<string, string> = {}
  for (const p of club.leadershipPositions) if (p.userId) roleByUser[p.userId] = p.title
  const members: User[] = club.memberIds.map(id => usersById[id]).filter(Boolean) as User[]

  const today = new Date().toISOString().split('T')[0]
  const upcomingEvents = events.filter(e => e.date >= today).slice(0, 4)
  const duesCents = club.duesAmountCents ?? 0
  const myDuesPaid = duesPayments.some(p => p.userId === currentUser.id && p.paid)
  const socials = club.socialLinks ?? []

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={css(`height:170px;position:relative;flex:none;background:${gradientFor(club.id)};`)}>
        <div style={{ position: 'absolute', top: TOP(8), left: 16 }}><BackButton light onClick={() => router.push('/clubs')} /></div>
        <div style={{ position: 'absolute', top: TOP(8), right: 16 }}>
          {isManager ? (
            <button onClick={() => router.push(`/clubs/${club.id}/manage`)} style={css('height:38px;padding:0 15px;border-radius:19px;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>Manage</button>
          ) : isMember ? (
            <button disabled={busy} onClick={() => membershipAction('leave')} style={css('height:38px;padding:0 15px;border-radius:19px;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;cursor:pointer;')}>Leave</button>
          ) : pending ? (
            <span style={css('height:38px;padding:0 15px;border-radius:19px;background:rgba(255,255,255,.18);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;')}>Pending</span>
          ) : (
            <button disabled={busy} onClick={() => membershipAction('join')} style={css('height:38px;padding:0 18px;border-radius:19px;border:none;background:#fff;color:#0f1729;font-size:13px;font-weight:800;cursor:pointer;')}>Join</button>
          )}
        </div>
        <div style={css('position:absolute;bottom:-30px;left:20px;width:72px;height:72px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 8px 20px rgba(15,23,42,.18);')}>{clubGlyph(club)}</div>
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

        {socials.length > 0 && (
          <div style={css('display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;')}>
            {socials.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={css('display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#6366f1;background:#fff;border:1px solid #eef0f3;padding:7px 12px;border-radius:10px;text-decoration:none;')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
                {s.platform}
              </a>
            ))}
          </div>
        )}

        {isMember && duesCents > 0 && (
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:14px 16px;margin-top:18px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            <div><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>Membership dues</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>${(duesCents / 100).toFixed(2)} per member</div></div>
            <span style={css(`font-size:11px;font-weight:800;padding:5px 11px;border-radius:9px;background:${myDuesPaid ? '#e8faf2' : '#fff7e6'};color:${myDuesPaid ? '#10b981' : '#b45309'};`)}>{myDuesPaid ? 'Paid' : 'Unpaid'}</span>
          </div>
        )}

        {isMember && currentUser.role === 'student' && (
          <div style={css('margin-top:18px;')}>
            <ScanCheckInButton className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-[#0058be] text-white text-sm font-bold px-5 py-3 shadow-lg shadow-blue-500/20 active:translate-y-px transition-transform touch-manipulation" />
          </div>
        )}

        {/* ── Updates / news ── */}
        {(news.length > 0 || canCreateContent) && (
          <>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin:22px 4px 11px;')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>Updates</div>
              {canCreateContent && <button onClick={() => setShowNewsSheet(true)} style={css('font-size:12.5px;font-weight:700;color:#6366f1;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;')}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Post</button>}
            </div>
            {news.length === 0 ? (
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:18px;text-align:center;font-size:12.5px;color:#9aa0ac;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>No updates yet.</div>
            ) : news.slice(0, 5).map(n => {
              const author = usersById[n.authorId]
              const canDelete = isManager || n.authorId === currentUser.id
              return (
                <div key={n.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:15px 16px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:8px;')}>
                    <div style={css('flex:1;min-width:0;')}>
                      <div style={css('display:flex;align-items:center;gap:7px;')}>
                        {n.isPinned && <span style={css('font-size:9px;font-weight:800;color:#6366f1;background:#eef0ff;padding:2px 6px;border-radius:6px;')}>PINNED</span>}
                        <span style={css("font-family:var(--font-manrope);font-weight:700;font-size:14.5px;color:#0f1729;")}>{n.title}</span>
                      </div>
                      <p style={css('font-size:13px;line-height:1.5;color:#5b6270;font-weight:500;margin:6px 0 0;')}>{n.content}</p>
                      <div style={css('font-size:11px;color:#9aa0ac;font-weight:500;margin-top:8px;')}>{author?.name ?? 'Staff'} · {relTime(n.createdAt)}</div>
                    </div>
                    {canDelete && <button onClick={() => contentAction({ action: 'delete_news', newsId: n.id }, 'Update deleted')} style={css('width:30px;height:30px;border-radius:9px;border:1px solid #eceef1;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd0d8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── Events ── */}
        {(upcomingEvents.length > 0 || canCreateContent) && (
          <>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin:22px 4px 11px;')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>Events</div>
              {canCreateContent && <button onClick={() => setShowEventSheet(true)} style={css('font-size:12.5px;font-weight:700;color:#6366f1;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;')}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Add</button>}
            </div>
            {upcomingEvents.length === 0 ? (
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:18px;text-align:center;font-size:12.5px;color:#9aa0ac;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>No upcoming events.</div>
            ) : upcomingEvents.map(ev => {
              const md = monthDay(ev.date)
              const canDelete = isManager || ev.createdBy === currentUser.id
              return (
                <div key={ev.id} style={css('display:flex;gap:13px;align-items:center;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:13px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <div style={css('width:48px;flex:none;text-align:center;background:#eef0ff;border-radius:13px;padding:8px 0;')}><div style={css('font-size:10px;font-weight:800;color:#6366f1;letter-spacing:.05em;')}>{md.month}</div><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:19px;color:#0f1729;line-height:1;margin-top:2px;")}>{md.day}</div></div>
                  <div style={css('flex:1;min-width:0;')}><div style={css('font-size:14px;font-weight:700;color:#0f1729;font-family:var(--font-manrope);')}>{ev.title}</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{ev.location || (ev.isPublic ? 'Public' : 'Members only')}</div></div>
                  {canDelete && (
                    <div style={css('display:flex;gap:7px;flex:none;')}>
                      <button onClick={() => setEditEvent(ev)} style={css('width:30px;height:30px;border-radius:9px;border:1px solid #eceef1;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd0d8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>
                      <button onClick={() => contentAction({ action: 'delete_event', eventId: ev.id }, 'Event deleted')} style={css('width:30px;height:30px;border-radius:9px;border:1px solid #eceef1;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd0d8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ── Elections / polls ── */}
        {(polls.length > 0 || isManager) && (
          <>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin:22px 4px 11px;')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>Elections</div>
              {isManager && <button onClick={() => setShowPollSheet(true)} style={css('font-size:12.5px;font-weight:700;color:#6366f1;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;')}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New</button>}
            </div>
            {polls.length === 0 ? (
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:18px;text-align:center;font-size:12.5px;color:#9aa0ac;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>No elections running.</div>
            ) : polls.map(p => {
              const total = p.candidates.reduce((a, c) => a + c.voteCount, 0)
              const canVote = p.isOpen && isMember && currentUser.role === 'student' && !p.myVoteCandidateId
              const sorted = [...p.candidates].sort((a, b) => b.voteCount - a.voteCount)
              return (
                <div key={p.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;margin-bottom:11px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;')}>
                    <span style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;")}>{p.positionTitle}</span>
                    <span style={css(`font-size:10px;font-weight:800;padding:4px 9px;border-radius:8px;background:${p.isOpen ? '#e8faf2' : '#eef0f3'};color:${p.isOpen ? '#10b981' : '#94a0b0'};`)}>{p.isOpen ? 'OPEN' : 'CLOSED'}</span>
                  </div>
                  {canVote && <div style={css('font-size:11.5px;font-weight:600;color:#6366f1;margin-top:10px;')}>Tap a candidate to vote</div>}
                  <div style={css('margin-top:11px;display:flex;flex-direction:column;gap:10px;')}>
                    {sorted.map(c => {
                      const pct = total ? Math.round((c.voteCount / total) * 100) : 0
                      const mine = p.myVoteCandidateId === c.userId
                      const row = (
                        <>
                          <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:8px;')}>
                            <span style={css('font-size:12.5px;font-weight:600;color:#1f2734;display:flex;align-items:center;gap:6px;min-width:0;')}>{usersById[c.userId]?.name ?? 'Candidate'}{mine && <span style={css('font-size:9px;font-weight:800;color:#10b981;background:#e8faf2;padding:2px 6px;border-radius:6px;flex:none;')}>YOUR VOTE</span>}</span>
                            {canVote ? <span style={css('font-size:11.5px;font-weight:700;color:#6366f1;flex:none;')}>Vote</span> : <span style={css('font-size:11.5px;font-weight:700;color:#8a8f9a;flex:none;')}>{c.voteCount} · {pct}%</span>}
                          </div>
                          <div style={css('height:8px;border-radius:6px;background:#eef0f3;overflow:hidden;')}><div style={css(`height:100%;border-radius:6px;background:${mine ? 'linear-gradient(90deg,#10b981,#34d399)' : '#cbd0d8'};width:${canVote ? 0 : pct}%;`)} /></div>
                        </>
                      )
                      return canVote
                        ? <button key={c.userId} onClick={() => vote(p.id, c.userId)} style={css('width:100%;text-align:left;border:1px solid #eef0f3;border-radius:12px;background:#fbfbfd;padding:10px 12px;cursor:pointer;')}>{row}</button>
                        : <div key={c.userId}>{row}</div>
                    })}
                  </div>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:13px;flex-wrap:wrap;')}>
                    <span style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>{total} total {total === 1 ? 'vote' : 'votes'}</span>
                    {isManager && (
                      <div style={css('display:flex;gap:8px;flex-wrap:wrap;')}>
                        {p.isOpen && <button onClick={() => contentAction({ action: 'close_poll', pollId: p.id }, 'Election closed')} style={css('font-size:12px;font-weight:700;color:#64748b;background:#f1f2f4;border:none;padding:6px 11px;border-radius:9px;cursor:pointer;')}>Close</button>}
                        {p.isOpen && <button onClick={() => contentAction({ action: 'appoint_poll_winner', pollId: p.id }, 'Winner appointed')} style={css('font-size:12px;font-weight:700;color:#fff;background:#10b981;border:none;padding:6px 11px;border-radius:9px;cursor:pointer;')}>Close &amp; appoint</button>}
                        <button onClick={() => setEditPoll(p)} style={css('font-size:12px;font-weight:700;color:#6366f1;background:#eef0ff;border:none;padding:6px 11px;border-radius:9px;cursor:pointer;')}>Edit</button>
                        <button onClick={() => contentAction({ action: 'delete_poll', pollId: p.id }, 'Election deleted')} style={css('font-size:12px;font-weight:700;color:#dc2626;background:#fee2e2;border:none;padding:6px 11px;border-radius:9px;cursor:pointer;')}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
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
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{u?.name ?? 'Student'}</div><div style={css('font-size:11px;color:#9aa0ac;')}>Wants to join · {relTime(r.requestedAt)}</div></div>
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
      {editEvent && clubId && <CreateEventSheet clubId={clubId} event={editEvent} onClose={() => setEditEvent(null)} onCreated={reload} />}
      {showNewsSheet && clubId && <CreateNewsSheet clubId={clubId} onClose={() => setShowNewsSheet(false)} onCreated={reload} />}
      {showPollSheet && clubId && <CreatePollSheet clubId={clubId} members={members} onClose={() => setShowPollSheet(false)} onCreated={reload} />}
      {editPoll && clubId && <CreatePollSheet clubId={clubId} members={members} poll={editPoll} onClose={() => setEditPoll(null)} onCreated={reload} />}
    </div>
  )
}

function MembershipNote({ count, shown }: { count: number; shown: number }) {
  if (count <= shown) return null
  return <div style={css('padding:11px 0;font-size:11.5px;color:#b3b9c4;text-align:center;')}>{count - shown} more not shown</div>
}
