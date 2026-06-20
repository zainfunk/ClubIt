'use client'

// Elections (route: /elections, phone + admin). Live via /api/school/elections;
// candidate names via fetchUsersByIds; close via PATCH /api/school/elections/[id].

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchUsersByIds } from '@/lib/school-data'
import type { SchoolElection, User } from '@/types'
import { css, BOTTOM } from '../css'
import { ScreenHeader, Loader, EmptyState } from '../primitives'
import { useToast } from '../toast'

export default function AdminElections() {
  const { actualUser } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const [elections, setElections] = useState<SchoolElection[] | null>(null)
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [tab, setTab] = useState<'open' | 'closed'>('open')

  useEffect(() => {
    if (!actualUser.schoolId) return
    let cancelled = false
    fetch('/api/school/elections', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (cancelled || !data?.elections) { if (!cancelled) setElections([]); return }
        const els = data.elections as SchoolElection[]
        const ids = Array.from(new Set(els.flatMap(e => e.candidates.map(c => c.userId))))
        const map = await fetchUsersByIds(ids)
        if (!cancelled) { setElections(els); setUsersById(map) }
      })
      .catch(() => { if (!cancelled) setElections([]) })
    return () => { cancelled = true }
  }, [actualUser.schoolId])

  async function closeElection(id: string) {
    setElections(prev => prev ? prev.map(e => e.id === id ? { ...e, isOpen: false } : e) : prev)
    toast('Election closed')
    try {
      await fetch(`/api/school/elections/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOpen: false }) })
    } catch { /* optimistic */ }
  }

  const shown = useMemo(() => (elections ?? []).filter(e => e.isOpen === (tab === 'open')), [elections, tab])

  const newBtn = (
    <button onClick={() => router.push('/admin')} style={css('height:36px;padding:0 14px;border-radius:18px;border:none;background:#0f1729;color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;flex:none;')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New
    </button>
  )

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
          {shown.length === 0 ? <EmptyState title={tab === 'open' ? 'No open elections' : 'No closed elections'} sub={tab === 'open' ? 'Start one from the admin dashboard.' : 'Closed elections will appear here.'} /> : shown.map(e => {
            const total = e.candidates.reduce((a, c) => a + c.voteCount, 0)
            const max = Math.max(...e.candidates.map(c => c.voteCount), 1)
            const sorted = [...e.candidates].sort((a, b) => b.voteCount - a.voteCount)
            const winner = !e.isOpen && sorted[0] ? usersById[sorted[0].userId]?.name : null
            return (
              <div key={e.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:8px;')}>
                  <div style={css('flex:1;min-width:0;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15.5px;color:#0f1729;letter-spacing:-.01em;")}>{e.positionTitle}</div>{e.description && <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;line-height:1.4;')}>{e.description}</div>}</div>
                  <span style={css(`font-size:10px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:8px;white-space:nowrap;flex:none;background:${e.isOpen ? '#e8faf2' : '#eef0f3'};color:${e.isOpen ? '#10b981' : '#94a0b0'};`)}>{e.isOpen ? 'OPEN' : 'CLOSED'}</span>
                </div>
                {winner && <div style={css('font-size:12px;font-weight:700;color:#10b981;background:#e8faf2;border-radius:10px;padding:7px 11px;margin-top:12px;')}>🏆 Winner: {winner}</div>}
                <div style={css('margin-top:13px;display:flex;flex-direction:column;gap:11px;')}>
                  {sorted.map(c => {
                    const lead = c.voteCount === max && total > 0
                    const pctNum = total ? Math.round((c.voteCount / total) * 100) : 0
                    return (
                      <div key={c.userId}>
                        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;')}><span style={css('font-size:12.5px;font-weight:600;color:#1f2734;')}>{usersById[c.userId]?.name ?? 'Candidate'}</span><span style={css('font-size:11.5px;font-weight:700;color:#8a8f9a;')}>{c.voteCount} · {pctNum}%</span></div>
                        <div style={css('height:8px;border-radius:6px;background:#eef0f3;overflow:hidden;')}><div style={css(`height:100%;border-radius:6px;background:${lead ? 'linear-gradient(90deg,#8b5cf6,#6366f1)' : '#cbd0d8'};width:${pctNum}%;`)} /></div>
                      </div>
                    )
                  })}
                </div>
                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:13px;')}>
                  <span style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>{total} total {total === 1 ? 'vote' : 'votes'}</span>
                  {e.isOpen && <button onClick={() => closeElection(e.id)} style={css('font-size:12px;font-weight:700;color:#64748b;background:#f1f2f4;border:none;padding:6px 12px;border-radius:9px;cursor:pointer;')}>Close election</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
