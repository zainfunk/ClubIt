'use client'

// Elections (route: /elections, phone). Role-aware: managers can create/close;
// everyone can vote in an open election (once). Live via /api/school/elections;
// candidate names via /api/school/users; votes via election-store.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolUsers } from '@/lib/school-api'
import { castVote } from '@/lib/election-store'
import type { SchoolElection, User } from '@/types'
import { css, BOTTOM } from '../css'
import { ScreenHeader, Loader, EmptyState } from '../primitives'
import { useToast } from '../toast'

export default function AdminElections() {
  const { actualUser, currentUser } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const [elections, setElections] = useState<SchoolElection[] | null>(null)
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [tab, setTab] = useState<'open' | 'closed'>('open')

  const canManage = currentUser.role === 'admin' || currentUser.role === 'superadmin'

  useEffect(() => {
    if (!actualUser.id) return
    let cancelled = false
    fetch('/api/school/elections', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (cancelled || !data?.elections) { if (!cancelled) setElections([]); return }
        const els = data.elections as SchoolElection[]
        const ids = new Set(els.flatMap(e => e.candidates.map(c => c.userId)))
        const users = await apiSchoolUsers().catch(() => [])
        const map: Record<string, User> = {}
        for (const u of users) if (ids.has(u.id)) map[u.id] = u
        if (!cancelled) { setElections(els); setUsersById(map) }
      })
      .catch(() => { if (!cancelled) setElections([]) })
    return () => { cancelled = true }
  }, [actualUser.id])

  async function closeElection(id: string) {
    setElections(prev => prev ? prev.map(e => e.id === id ? { ...e, isOpen: false } : e) : prev)
    toast('Election closed')
    try {
      await fetch(`/api/school/elections/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOpen: false }) })
    } catch { /* optimistic */ }
  }

  async function vote(electionId: string, candidateUserId: string) {
    setElections(prev => prev ? prev.map(e => e.id === electionId
      ? { ...e, myVoteCandidateId: candidateUserId, candidates: e.candidates.map(c => c.userId === candidateUserId ? { ...c, voteCount: c.voteCount + 1 } : c) }
      : e) : prev)
    toast('Vote cast')
    try { await castVote(electionId, candidateUserId, currentUser.id) } catch { /* optimistic */ }
  }

  const shown = useMemo(() => (elections ?? []).filter(e => e.isOpen === (tab === 'open')), [elections, tab])

  const newBtn = canManage ? (
    <button onClick={() => router.push('/admin')} style={css('height:36px;padding:0 14px;border-radius:18px;border:none;background:#0f1729;color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;flex:none;')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New
    </button>
  ) : undefined

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Elections" right={newBtn}>
        <div style={css('display:flex;gap:6px;background:#e6e6ec;border-radius:12px;padding:4px;margin-top:13px;')}>
          {(['open', 'closed'] as const).map(t => {
            const on = tab === t
            return <button key={t} onClick={() => setTab(t)} style={css(`flex:1;height:33px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:700;text-transform:capitalize;background:${on ? '#fff' : 'transparent'};color:${on ? '#0f1729' : '#8a8f9a'};box-shadow:${on ? '0 1px 3px rgba(15,23,41,.12)' : 'none'};`)}>{t}</button>
          })}
        </div>
      </ScreenHeader>
      {elections === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:10px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {shown.length === 0 ? <EmptyState title={tab === 'open' ? 'No open elections' : 'No closed elections'} sub={tab === 'open' ? 'Open elections will appear here.' : 'Closed elections will appear here.'} /> : shown.map(e => {
            const total = e.candidates.reduce((a, c) => a + c.voteCount, 0)
            const max = Math.max(...e.candidates.map(c => c.voteCount), 1)
            const sorted = [...e.candidates].sort((a, b) => b.voteCount - a.voteCount)
            const winner = !e.isOpen && sorted[0] ? usersById[sorted[0].userId]?.name : null
            const votable = e.isOpen && !e.myVoteCandidateId
            return (
              <div key={e.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:8px;')}>
                  <div style={css('flex:1;min-width:0;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15.5px;color:#0f1729;letter-spacing:-.01em;")}>{e.positionTitle}</div>{e.description && <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;line-height:1.4;')}>{e.description}</div>}</div>
                  <span style={css(`font-size:10px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:8px;white-space:nowrap;flex:none;background:${e.isOpen ? '#e8faf2' : '#eef0f3'};color:${e.isOpen ? '#10b981' : '#94a0b0'};`)}>{e.isOpen ? 'OPEN' : 'CLOSED'}</span>
                </div>
                {winner && <div style={css('font-size:12px;font-weight:700;color:#10b981;background:#e8faf2;border-radius:10px;padding:7px 11px;margin-top:12px;')}>🏆 Winner: {winner}</div>}
                {votable && <div style={css('font-size:11.5px;font-weight:600;color:#6366f1;margin-top:11px;')}>Tap a candidate to cast your vote</div>}
                <div style={css('margin-top:11px;display:flex;flex-direction:column;gap:11px;')}>
                  {sorted.map(c => {
                    const lead = c.voteCount === max && total > 0
                    const pctNum = total ? Math.round((c.voteCount / total) * 100) : 0
                    const mine = e.myVoteCandidateId === c.userId
                    const row = (
                      <>
                        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:8px;')}>
                          <span style={css('font-size:12.5px;font-weight:600;color:#1f2734;display:flex;align-items:center;gap:6px;min-width:0;')}>{usersById[c.userId]?.name ?? 'Candidate'}{mine && <span style={css('font-size:9px;font-weight:800;color:#10b981;background:#e8faf2;padding:2px 6px;border-radius:6px;flex:none;')}>YOUR VOTE</span>}</span>
                          {votable ? <span style={css('font-size:11.5px;font-weight:700;color:#6366f1;flex:none;')}>Vote</span> : <span style={css('font-size:11.5px;font-weight:700;color:#8a8f9a;flex:none;')}>{c.voteCount} · {pctNum}%</span>}
                        </div>
                        <div style={css('height:8px;border-radius:6px;background:#eef0f3;overflow:hidden;')}><div style={css(`height:100%;border-radius:6px;background:${mine ? 'linear-gradient(90deg,#10b981,#34d399)' : lead ? 'linear-gradient(90deg,#8b5cf6,#6366f1)' : '#cbd0d8'};width:${votable ? 0 : pctNum}%;`)} /></div>
                      </>
                    )
                    return votable
                      ? <button key={c.userId} onClick={() => vote(e.id, c.userId)} style={css('width:100%;text-align:left;border:1px solid #eef0f3;border-radius:12px;background:#fbfbfd;padding:10px 12px;cursor:pointer;')}>{row}</button>
                      : <div key={c.userId}>{row}</div>
                  })}
                </div>
                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:13px;')}>
                  <span style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>{e.myVoteCandidateId ? 'You voted · ' : ''}{total} total {total === 1 ? 'vote' : 'votes'}</span>
                  {canManage && e.isOpen && <button onClick={() => closeElection(e.id)} style={css('font-size:12px;font-weight:700;color:#64748b;background:#f1f2f4;border:none;padding:6px 12px;border-radius:9px;cursor:pointer;')}>Close election</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
